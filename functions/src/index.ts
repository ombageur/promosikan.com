import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";

// Region final masih keputusan terbuka #5 (SPEC §26).
setGlobalOptions({ region: "asia-southeast2", maxInstances: 10 });

/** Health check untuk memastikan deploy & emulator berjalan. Tidak mengakses data. */
export const health = onRequest((_req, res) => {
  res.json({ status: "ok", service: "promosikan-functions" });
});
