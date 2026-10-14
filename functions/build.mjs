// Membundel functions + ../shared menjadi lib/index.js.
// Dependensi npm tetap eksternal dan di-install oleh Cloud Build dari package.json ini.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "lib/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  packages: "external",
  sourcemap: true,
  alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) },
  logLevel: "info",
});
