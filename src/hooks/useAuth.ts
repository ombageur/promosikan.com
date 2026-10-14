import { useContext } from "react";
import { AuthContext } from "@/contexts/auth-context";

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth harus dipakai di dalam <AuthProvider>");
  return context;
}

/** Untuk komponen di balik <RequireAuth>: user dijamin ada. */
export function useCurrentUser() {
  const { user } = useAuth();
  if (!user) throw new Error("useCurrentUser dipakai di luar rute yang dilindungi");
  return user;
}
