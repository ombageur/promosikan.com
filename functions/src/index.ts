import { defineString } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { onCall, onRequest } from "firebase-functions/v2/https";
import { db } from "./utils/admin";
import { callableOptions, requireAuth } from "./utils/context";
import { createWorkspaceHandler } from "./workspace/createWorkspace";
import { acceptInvitationHandler, inviteMemberHandler, revokeInvitationHandler } from "./workspace/invitations";
import { removeMemberHandler, transferOwnershipHandler, updateMemberRoleHandler } from "./workspace/members";

// Region final masih keputusan terbuka #5 (SPEC §26).
setGlobalOptions({ region: "asia-southeast2", maxInstances: 10 });

/** URL frontend untuk link undangan. Set lewat functions/.env.<project> (APP_URL=https://promosikan.com). */
const appUrl = defineString("APP_URL", { default: "http://localhost:5173" });

/** Health check untuk memastikan deploy & emulator berjalan. Tidak mengakses data. */
export const health = onRequest((_req, res) => {
  res.json({ status: "ok", service: "promosikan-functions" });
});

export const createWorkspace = onCall(callableOptions, (req) => createWorkspaceHandler(db, requireAuth(req), req.data));
export const inviteMember = onCall(callableOptions, (req) =>
  inviteMemberHandler(db, requireAuth(req), req.data, { appUrl: appUrl.value() }),
);
export const acceptInvitation = onCall(callableOptions, (req) => acceptInvitationHandler(db, requireAuth(req), req.data));
export const revokeInvitation = onCall(callableOptions, (req) => revokeInvitationHandler(db, requireAuth(req), req.data));
export const updateMemberRole = onCall(callableOptions, (req) => updateMemberRoleHandler(db, requireAuth(req), req.data));
export const removeMember = onCall(callableOptions, (req) => removeMemberHandler(db, requireAuth(req), req.data));
export const transferOwnership = onCall(callableOptions, (req) => transferOwnershipHandler(db, requireAuth(req), req.data));
