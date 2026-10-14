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
  /** Path relatif terhadap basePath workspace (`/w/:id` atau `/demo`). */
  path: string;
  /** Item disembunyikan jika role tidak punya izin ini. */
  permission?: Permission;
  end?: boolean;
  /** Disembunyikan di demo publik (butuh akun). */
  requiresAccount?: boolean;
};

export type NavGroup = { label: string; items: NavItem[] };

/** Sidebar berkelompok (SPEC §22). */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Utama",
    items: [
      { label: "Overview", icon: LayoutDashboard, path: "", end: true },
      { label: "Discover", icon: Compass, path: "discover" },
      { label: "Opportunities", icon: Target, path: "opportunities" },
      { label: "Smart Match", icon: Sparkles, path: "smart-match" },
      { label: "Reply Center", icon: MessageCircle, path: "reply-center" },
      { label: "Leads CRM", icon: Users, path: "leads" },
      { label: "Analytics", icon: BarChart3, path: "analytics" },
    ],
  },
  {
    label: "Konfigurasi",
    items: [
      { label: "Products & Services", icon: BriefcaseBusiness, path: "products" },
      { label: "Automation", icon: Bot, path: "automation" },
      { label: "Integrations", icon: Activity, path: "integrations" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Pengaturan Workspace", icon: Settings2, path: "settings", end: true },
      { label: "Anggota Tim", icon: UsersRound, path: "settings/members", requiresAccount: true },
      { label: "Billing", icon: CreditCard, path: "billing", permission: "billing.manage" },
    ],
  },
];
