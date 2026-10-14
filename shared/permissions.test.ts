import { describe, expect, it } from "vitest";
import { ASSIGNABLE_ROLES, can, canChangeRole, canLeave, canRemoveMember, type Permission, PERMISSIONS, ROLES } from "./permissions";

describe("matriks permission (SPEC §4)", () => {
  it("semua role bisa membaca workspace", () => {
    for (const role of ROLES) expect(can(role, "workspace.read")).toBe(true);
  });

  it("viewer tidak punya izin menulis apa pun", () => {
    const writes = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => p !== "workspace.read");
    for (const p of writes) expect(can("viewer", p)).toBe(false);
  });

  it("sales bisa mengedit draft tetapi tidak bisa approve/kirim", () => {
    expect(can("sales", "reply.edit")).toBe(true);
    expect(can("sales", "reply.publish")).toBe(false);
  });

  it("hanya owner yang mengelola billing, hapus workspace, dan transfer ownership", () => {
    for (const p of ["billing.manage", "workspace.delete", "ownership.transfer"] as const) {
      expect(ROLES.filter((r) => can(r, p))).toEqual(["owner"]);
    }
  });

  it("integrasi dan automation hanya owner/admin", () => {
    expect(ROLES.filter((r) => can(r, "integrations.manage"))).toEqual(["owner", "admin"]);
    expect(ROLES.filter((r) => can(r, "automation.manage"))).toEqual(["owner", "admin"]);
  });

  it("role kosong tidak punya izin", () => {
    expect(can(null, "workspace.read")).toBe(false);
    expect(can(undefined, "workspace.read")).toBe(false);
  });
});

describe("aturan pengelolaan anggota", () => {
  it("owner tidak bisa diberikan lewat undangan atau ubah role", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("owner");
    expect(canChangeRole("owner", "admin", "owner")).toBe(false);
  });

  it("admin tidak bisa mengubah atau mengeluarkan owner", () => {
    expect(canChangeRole("admin", "owner", "viewer")).toBe(false);
    expect(canRemoveMember("admin", "owner")).toBe(false);
  });

  it("admin bisa mengelola role non-owner", () => {
    expect(canChangeRole("admin", "viewer", "marketing")).toBe(true);
    expect(canRemoveMember("admin", "sales")).toBe(true);
  });

  it("role selain owner/admin tidak bisa mengelola anggota", () => {
    for (const actor of ["marketing", "sales", "viewer"] as const) {
      expect(canChangeRole(actor, "viewer", "sales")).toBe(false);
      expect(canRemoveMember(actor, "viewer")).toBe(false);
    }
  });

  it("owner tidak bisa keluar tanpa transfer ownership", () => {
    expect(canLeave("owner")).toBe(false);
    expect(canLeave("viewer")).toBe(true);
  });
});
