import {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Compass,
  CreditCard,
  LayoutDashboard,
  type LucideIcon,
  MessageCircle,
  Settings2,
  Sparkles,
  Target,
  Users,
  UsersRound,
} from "lucide-react";
import type { Permission } from "@shared/permissions";

export type NavItem = {
  label: string;
  icon: LucideIcon;
  /** Path relatif terhadap /w/:workspaceId. `null` = belum tersedia di fase ini. */
  path: string | null;
  /** Item disembunyikan jika role tidak punya izin ini. */
  permission?: Permission;
  end?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

/** Sidebar berkelompok (SPEC §22). Item dengan path null aktif di fase berikutnya. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Utama",
    items: [
      { label: "Overview", icon: LayoutDashboard, path: "", end: true },
      { label: "Discover", icon: Compass, path: null },
      { label: "Opportunities", icon: Target, path: null },
      { label: "Smart Match", icon: Sparkles, path: null },
      { label: "Reply Center", icon: MessageCircle, path: null },
      { label: "Leads CRM", icon: Users, path: null },
      { label: "Analytics", icon: BarChart3, path: null },
    ],
  },
  {
    label: "Konfigurasi",
    items: [
      { label: "Products & Services", icon: BriefcaseBusiness, path: null },
      { label: "Automation", icon: Bot, path: null },
      { label: "Integrations", icon: Activity, path: null },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Pengaturan Workspace", icon: Settings2, path: "settings", end: true },
      { label: "Anggota Tim", icon: UsersRound, path: "settings/members" },
      { label: "Billing", icon: CreditCard, path: null, permission: "billing.manage" },
    ],
  },
];
