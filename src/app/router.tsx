import { createBrowserRouter, type RouteObject } from "react-router";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { GuestOnly, RequireAuth, RequireVerifiedEmail } from "@/routes/guards";

// Halaman dimuat saat dibuka: beranda tidak ikut memuat Firestore/Storage/Functions maupun Recharts.
const page = <M,>(load: () => Promise<M>, pick: (m: M) => React.ComponentType) => () =>
  load().then((m) => ({ Component: pick(m) }));


/** Halaman workspace dipakai bersama oleh /w/:workspaceId dan /demo. */
function workspacePages({ withMembers }: { withMembers: boolean }): RouteObject[] {
  return [
    { index: true, lazy: page(() => import("@/pages/workspace/OverviewPage"), (m) => m.OverviewPage) },
    { path: "discover", lazy: page(() => import("@/pages/workspace/DiscoverPage"), (m) => m.DiscoverPage) },
    { path: "opportunities", lazy: page(() => import("@/pages/workspace/OpportunitiesPage"), (m) => m.OpportunitiesPage) },
    { path: "smart-match", lazy: page(() => import("@/pages/workspace/SmartMatchPage"), (m) => m.SmartMatchPage) },
    { path: "reply-center", lazy: page(() => import("@/pages/workspace/ReplyCenterPage"), (m) => m.ReplyCenterPage) },
    { path: "leads", lazy: page(() => import("@/pages/workspace/LeadsPage"), (m) => m.LeadsPage) },
    { path: "analytics", lazy: page(() => import("@/pages/workspace/AnalyticsPage"), (m) => m.AnalyticsPage) },
    { path: "products", lazy: page(() => import("@/pages/workspace/ProductsPage"), (m) => m.ProductsPage) },
    { path: "automation", lazy: page(() => import("@/pages/workspace/AutomationPage"), (m) => m.AutomationPage) },
    { path: "integrations", lazy: page(() => import("@/pages/workspace/IntegrationsPage"), (m) => m.IntegrationsPage) },
    { path: "settings", lazy: page(() => import("@/pages/workspace/SettingsPage"), (m) => m.SettingsPage) },
    ...(withMembers ? [{ path: "settings/members", lazy: page(() => import("@/pages/workspace/MembersPage"), (m) => m.MembersPage) }] : []),
    { path: "billing", lazy: page(() => import("@/pages/workspace/BillingPage"), (m) => m.BillingPage) },
    { path: "*", element: <NotFoundPage /> },
  ];
}

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/demo", lazy: page(() => import("@/pages/demo/DemoRoute"), (m) => m.DemoRoute), children: workspacePages({ withMembers: false }) },
  {
    element: <GuestOnly />,
    children: [
      { path: "/login", lazy: page(() => import("@/pages/auth/LoginPage"), (m) => m.LoginPage) },
      { path: "/register", lazy: page(() => import("@/pages/auth/RegisterPage"), (m) => m.RegisterPage) },
      { path: "/forgot-password", lazy: page(() => import("@/pages/auth/ForgotPasswordPage"), (m) => m.ForgotPasswordPage) },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: "/verify-email", lazy: page(() => import("@/pages/auth/VerifyEmailPage"), (m) => m.VerifyEmailPage) },
      {
        element: <RequireVerifiedEmail />,
        children: [
          { path: "/app", lazy: page(() => import("@/pages/app/AppIndexPage"), (m) => m.AppIndexPage) },
          { path: "/onboarding", lazy: page(() => import("@/pages/app/OnboardingPage"), (m) => m.OnboardingPage) },
          { path: "/invite/:inviteId", lazy: page(() => import("@/pages/app/InvitePage"), (m) => m.InvitePage) },
          { path: "/w/:workspaceId", lazy: page(() => import("@/pages/workspace/WorkspaceRoute"), (m) => m.WorkspaceRoute), children: workspacePages({ withMembers: true }) },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
