/**
 * Matriks role per workspace (SPEC §4) — satu-satunya sumber kebenaran.
 * Dipakai frontend (menyembunyikan UI), Cloud Functions (enforcement), dan tes rules.
 * firestore.rules mencerminkan matriks ini; tes rules memverifikasi keduanya selaras.
 */
export const ROLES = ["owner", "admin", "marketing", "sales", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** Role yang bisa diberikan lewat undangan atau ubah role. Owner hanya lewat transfer ownership. */
export const ASSIGNABLE_ROLES = ["admin", "marketing", "sales", "viewer"] as const satisfies readonly Role[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  marketing: "Marketing",
  sales: "Sales",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Akses penuh termasuk billing, hapus workspace, dan transfer ownership.",
  admin: "Kelola anggota, integrasi, automation, dan semua data workspace.",
  marketing: "Kelola katalog & keyword, gunakan AI, serta approve dan kirim balasan.",
  sales: "Gunakan AI, edit draft balasan, dan kelola lead CRM.",
  viewer: "Hanya melihat data workspace.",
};

const ALL = ROLES;
const MANAGERS = ["owner", "admin"] as const;

export const PERMISSIONS = {
  "workspace.read": ALL,
  "workspace.update": MANAGERS,
  "workspace.delete": ["owner"],
  "ownership.transfer": ["owner"],
  "members.manage": MANAGERS,
  "audit.read": MANAGERS,
  "catalog.manage": ["owner", "admin", "marketing"],
  "ai.use": ["owner", "admin", "marketing", "sales"],
  "reply.edit": ["owner", "admin", "marketing", "sales"],
  "reply.publish": ["owner", "admin", "marketing"],
  "leads.manage": ["owner", "admin", "marketing", "sales"],
  "integrations.manage": MANAGERS,
  "automation.manage": MANAGERS,
  "billing.manage": ["owner"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/**
 * Apakah `actor` boleh mengubah role anggota dari `current` menjadi `next`.
 * Owner tidak pernah bisa diubah lewat jalur ini (gunakan transfer ownership).
 */
export function canChangeRole(actor: Role, current: Role, next: Role): boolean {
  if (!can(actor, "members.manage")) return false;
  return current !== "owner" && next !== "owner";
}

/** Apakah `actor` boleh mengeluarkan anggota dengan role `target`. Keluar sendiri ditangani `canLeave`. */
export function canRemoveMember(actor: Role, target: Role): boolean {
  return can(actor, "members.manage") && target !== "owner";
}

/** Anggota non-owner boleh keluar sendiri; owner harus transfer ownership dulu. */
export function canLeave(role: Role): boolean {
  return role !== "owner";
}
