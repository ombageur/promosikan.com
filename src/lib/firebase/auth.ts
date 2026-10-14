import { connectAuthEmulator, getAuth } from "firebase/auth";
import { app } from "./app";
import { useEmulators } from "./config";

export const auth = getAuth(app);
if (useEmulators) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
