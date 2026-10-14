import type { User } from "firebase/auth";
import { createContext } from "react";

export type AuthState = {
  /** null = belum login; undefined tidak dipakai — gunakan `loading`. */
  user: User | null;
  loading: boolean;
  emailVerified: boolean;
  /** Paksa render ulang setelah `user.reload()` (objek User dimutasi di tempat oleh SDK). */
  refreshUser: () => void;
};

export const AuthContext = createContext<AuthState | null>(null);
