type FromState = { from?: string } | null;

/** Path tujuan setelah login — hanya path internal agar tidak bisa dipakai sebagai open redirect. */
export function redirectTarget(state: unknown, fallback = "/app") {
  const from = (state as FromState)?.from;
  return typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : fallback;
}
