// Bundel eval (memakai @shared + src/ai) lalu jalankan; dependensi npm tetap eksternal.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

await build({
  entryPoints: ["eval/run-eval.ts"],
  outfile: "eval/.out/run-eval.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  alias: { "@shared": fileURLToPath(new URL("../../shared", import.meta.url)) },
  logLevel: "warning",
});
const result = spawnSync(process.execPath, ["eval/.out/run-eval.mjs", ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
