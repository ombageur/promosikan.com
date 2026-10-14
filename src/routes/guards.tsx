import { Navigate, Outlet, useLocation } from "react-router";
import { FullPageSpinner } from "@/components/layout/states";
import { useAuth } from "@/hooks/useAuth";
import { redirectTarget } from "./redirect";

/** Hanya untuk pengguna yang sudah login. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Hanya untuk pengguna dengan email terverifikasi (dibutuhkan Security Rules & Functions). */
export function RequireVerifiedEmail() {
  const { emailVerified } = useAuth();
  const location = useLocation();
  if (!emailVerified) return <Navigate to="/verify-email" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Halaman login/daftar: pengguna yang sudah login diarahkan ke aplikasi. */
export function GuestOnly() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (user) return <Navigate to={redirectTarget(location.state)} replace />;
  return <Outlet />;
}
