// Bundel eval (memakai @shared + src/ai) lalu jalankan; dependensi npm tetap eksternal.
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

// Key dari env, atau dari functions/.secret.local (diabaikan git). Key tiruan ("fake…") dilewati.
const env = { ...process.env };
if (!env.ANTHROPIC_API_KEY && existsSync(".secret.local")) {
  const line = readFileSync(".secret.local", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("ANTHROPIC_API_KEY="));
  const key = line?.slice("ANTHROPIC_API_KEY=".length).trim();
  if (key && !key.startsWith("fake")) env.ANTHROPIC_API_KEY = key;
}

const result = spawnSync(process.execPath, ["eval/.out/run-eval.mjs", ...process.argv.slice(2)], { stdio: "inherit", env });
process.exit(result.status ?? 1);
