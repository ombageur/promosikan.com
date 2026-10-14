import { connectStorageEmulator, getStorage } from "firebase/storage";
import { app } from "./app";
import { useEmulators } from "./config";

export const storage = getStorage(app);
if (useEmulators) connectStorageEmulator(storage, "127.0.0.1", 9199);
