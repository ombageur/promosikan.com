import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@shared/permissions";

export const ROLE_ITEMS = ASSIGNABLE_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }));
