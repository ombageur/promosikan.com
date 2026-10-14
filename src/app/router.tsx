import { createBrowserRouter } from "react-router";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { GuestOnly, RequireAuth, RequireVerifiedEmail } from "@/routes/guards";

// Halaman dimuat saat dibuka: beranda tidak ikut memuat Firestore/Storage/Functions maupun Recharts.
const page = <M,>(load: () => Promise<M>, pick: (m: M) => React.ComponentType) => () =>
  load().then((m) => ({ Component: pick(m) }));

const demo = page(() => import("@/pages/DemoPage"), (m) => m.DemoPage);
const workspace = () => import("@/pages/workspace");

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/demo", lazy: demo },
  { path: "/demo/:section", lazy: demo },
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
          {
            path: "/w/:workspaceId",
            lazy: page(workspace, (m) => m.WorkspaceRoute),
            children: [
              { index: true, lazy: page(workspace, (m) => m.OverviewPage) },
              { path: "settings", lazy: page(workspace, (m) => m.SettingsPage) },
              { path: "settings/members", lazy: page(workspace, (m) => m.MembersPage) },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
