import { assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { can, ROLES } from "../../shared/permissions";
import { asUser, createEnv, OUTSIDER, seed, WS1_MEMBERS } from "./setup";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createEnv();
});
beforeEach(async () => {
  await seed(env);
});
afterAll(async () => {
  await env.cleanup();
});

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const upload = (uid: string, path: string, data = png, contentType = "image/png") =>
  uploadBytes(ref(asUser(env, uid).storage(), path), data, { contentType });

describe("logo workspace", () => {
  it("upload mengikuti matriks workspace.update", async () => {
    for (const role of ROLES) {
      const attempt = upload(WS1_MEMBERS[role], `workspaces/ws1/logo/${role}.png`);
      if (can(role, "workspace.update")) await assertSucceeds(attempt);
      else await assertFails(attempt);
    }
  });

  it("orang luar tidak bisa upload atau membaca logo workspace lain", async () => {
    await upload("alice", "workspaces/ws1/logo/logo.png");
    await assertFails(upload(OUTSIDER, "workspaces/ws1/logo/logo.png"));
    await assertFails(getBytes(ref(asUser(env, OUTSIDER).storage(), "workspaces/ws1/logo/logo.png")));
    await assertSucceeds(getBytes(ref(asUser(env, "vic").storage(), "workspaces/ws1/logo/logo.png")));
  });

  it("menolak file non-gambar dan file ≥ 2 MB", async () => {
    await assertFails(upload("alice", "workspaces/ws1/logo/x.txt", png, "text/plain"));
    await assertFails(upload("alice", "workspaces/ws1/logo/besar.png", new Uint8Array(2 * 1024 * 1024)));
  });

  it("path di luar folder logo ditolak", async () => {
    await assertFails(upload("alice", "workspaces/ws1/lain/x.png"));
    await assertFails(upload("alice", "bebas/x.png"));
  });
});
