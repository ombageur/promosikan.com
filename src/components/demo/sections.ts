import { Activity, BarChart3, Bot, BriefcaseBusiness, Compass, CreditCard, LayoutDashboard, MessageCircle, Settings2, Sparkles, Target, Users } from "lucide-react";

export const overviewSection = { slug: "overview", label: "Overview", icon: LayoutDashboard };

export const sections = [
  overviewSection, { slug: "discover", label: "Discover", icon: Compass },
  { slug: "opportunities", label: "Opportunities", icon: Target }, { slug: "smart-match", label: "Smart Match", icon: Sparkles },
  { slug: "reply-center", label: "Reply Center", icon: MessageCircle }, { slug: "leads", label: "Leads CRM", icon: Users },
  { slug: "analytics", label: "Analytics", icon: BarChart3 }, { slug: "products", label: "Products & Services", icon: BriefcaseBusiness },
  { slug: "automation", label: "Automation", icon: Bot }, { slug: "integrations", label: "Integrations", icon: Activity },
  { slug: "settings", label: "Workspace Settings", icon: Settings2 }, { slug: "billing", label: "Billing", icon: CreditCard },
];

