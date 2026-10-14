import { z } from "zod";
import { ASSIGNABLE_ROLES } from "../permissions";

const optionalText = (max: number) => z.string().trim().max(max).default("");
const optionalUrl = z.union([z.url({ protocol: /^https?$/ }), z.literal("")]).default("");
const optionalEmail = z.union([z.email(), z.literal("")]).default("");

export const LANGUAGES = ["id", "en"] as const;

/** Profil workspace yang boleh diubah Owner/Admin langsung dari client (dicek ulang oleh firestore.rules). */
export const workspaceProfileSchema = z.object({
  name: z.string().trim().min(2, "Minimal 2 karakter").max(100),
  businessName: z.string().trim().min(2, "Minimal 2 karakter").max(100),
  industry: optionalText(100),
  website: optionalUrl,
  description: optionalText(1000),
  location: optionalText(150),
  contactEmail: optionalEmail,
  contactPhone: optionalText(30),
  brandVoice: optionalText(200),
  preferredLanguage: z.enum(LANGUAGES).default("id"),
});
export type WorkspaceProfile = z.infer<typeof workspaceProfileSchema>;
export type WorkspaceProfileInput = z.input<typeof workspaceProfileSchema>;

const workspaceId = z.string().min(1).max(128);
const uid = z.string().min(1).max(128);
const assignableRole = z.enum(ASSIGNABLE_ROLES);

export const createWorkspaceInput = z.object({
  name: workspaceProfileSchema.shape.name,
  businessName: workspaceProfileSchema.shape.businessName,
  industry: optionalText(100),
});
export type CreateWorkspaceInput = z.input<typeof createWorkspaceInput>;

export const inviteMemberInput = z.object({
  workspaceId,
  email: z
    .email("Email tidak valid")
    .max(254)
    .transform((e) => e.toLowerCase()),
  role: assignableRole,
});
export type InviteMemberInput = z.input<typeof inviteMemberInput>;

export const acceptInvitationInput = z.object({
  inviteId: z.string().min(1).max(128),
  token: z.string().min(20).max(200),
});

export const revokeInvitationInput = z.object({ workspaceId, inviteId: z.string().min(1).max(128) });
export const updateMemberRoleInput = z.object({ workspaceId, uid, role: assignableRole });
export const removeMemberInput = z.object({ workspaceId, uid });
export const transferOwnershipInput = z.object({ workspaceId, newOwnerUid: uid });

export const INVITATION_TTL_DAYS = 7;
export const MAX_OWNED_WORKSPACES = 5;
export const MAX_INVITES_PER_DAY = 50;
