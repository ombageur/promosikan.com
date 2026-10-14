import { onAuthStateChanged, type User } from "firebase/auth";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { queryClient } from "@/app/queryClient";
import { auth } from "@/lib/firebase/auth";
import { AuthContext, type AuthState } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setUser(next);
        setLoading(false);
        if (!next) {
          queryClient.clear(); // jangan bawa cache data pengguna sebelumnya
          return;
        }
        // Firestore dimuat terpisah agar halaman publik tidak ikut memuat SDK-nya.
        import("@/services/users")
          .then(({ ensureUserProfile }) => ensureUserProfile(next))
          .catch((error: unknown) => console.error("Gagal sinkron profil pengguna", error));
      }),
    [],
  );

  const refreshUser = useCallback(() => setVersion((v) => v + 1), []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, emailVerified: user?.emailVerified ?? false, refreshUser }),
    // `version` memaksa nilai baru setelah user.reload() mengubah objek yang sama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading, refreshUser, version],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
