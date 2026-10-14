import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { app } from "./app";
import { useEmulators } from "./config";

export const FUNCTIONS_REGION = "asia-southeast2";

export const functions = getFunctions(app, FUNCTIONS_REGION);
if (useEmulators) connectFunctionsEmulator(functions, "127.0.0.1", 5001);
