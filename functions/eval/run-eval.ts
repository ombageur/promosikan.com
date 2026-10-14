/**
 * Eval analisis peluang terhadap Claude sungguhan: `npm run eval:ai` (dari root).
 * - Tanpa `--yes`: hanya menampilkan rencana & estimasi biaya (tidak memanggil API).
 * - Dengan `--yes` dan ANTHROPIC_API_KEY: menjalankan semua kasus dan melaporkan akurasi.
 * Model: CLAUDE_MODEL (default claude-opus-5-5). Hasil lengkap ditulis ke eval/.out/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { DEMO_OFFERINGS, DEMO_PROFILE } from "@shared/demo/publishAgency";
import { analysisStrictSchema } from "@shared/schemas/ai";
import { DEFAULT_AUTOMATION_SETTINGS } from "@shared/schemas/automation";
import { buildOpportunityFields } from "../src/ai/analyze";
import { claudeClient, type LlmUsage } from "../src/ai/llm";
import { estimateCostUsd } from "../src/ai/pricing";
import { buildAnalyzeRequest } from "../src/ai/prompts/analyze";
import { EVAL_CASES, type EvalCase } from "./dataset";

const model = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
const confirmed = process.argv.includes("--yes");
const apiKey = process.env.ANTHROPIC_API_KEY;
const CONCURRENCY = 4;

type Row = {
  id: string;
  ok: boolean;
  status: "ok" | "refused" | "invalid" | "error";
  intent?: string;
  commercial?: boolean;
  match?: string | null;
  sensitive?: boolean;
  score?: number;
  checks: { intent: boolean; commercial: boolean; match: boolean; sensitive: boolean };
  usd: number;
  ms: number;
  detail?: string;
};

async function runCase(llm: ReturnType<typeof claudeClient>, c: EvalCase): Promise<Row> {
  const start = Date.now();
  const empty = { intent: false, commercial: false, match: false, sensitive: false };
  try {
    const result = await llm.complete(buildAnalyzeRequest({ profile: DEMO_PROFILE, catalog: DEMO_OFFERINGS, text: c.text }));
    const usd = estimateCostUsd(result.usage as LlmUsage).usd;
    const ms = Date.now() - start;
    if (result.kind === "refused") {
      // Penolakan dihitung sebagai "sensitif terdeteksi" dan "tidak dicocokkan".
      return {
        id: c.id, ok: false, status: "refused", usd, ms, match: null, sensitive: true,
        checks: { intent: false, commercial: !c.commercial, match: c.match === null, sensitive: c.sensitive },
      };
    }
    if (result.kind === "incomplete") return { id: c.id, ok: false, status: "invalid", usd, ms, checks: empty, detail: result.reason };
    const parsed = analysisStrictSchema.safeParse(result.json);
    if (!parsed.success) return { id: c.id, ok: false, status: "invalid", usd, ms, checks: empty, detail: parsed.error.issues[0]?.message };

    const fields = buildOpportunityFields(parsed.data, DEMO_OFFERINGS, DEFAULT_AUTOMATION_SETTINGS.minMatchScore);
    const match = fields.matches[0]?.offeringId ?? null;
    const sensitive = fields.redFlags.length > 0;
    const checks = {
      intent: parsed.data.intent === c.intent,
      commercial: parsed.data.isCommercialIntent === c.commercial,
      match: match === c.match,
      sensitive: sensitive === c.sensitive,
    };
    return {
      id: c.id, ok: true, status: "ok", usd, ms, checks,
      intent: parsed.data.intent, commercial: parsed.data.isCommercialIntent, match, sensitive, score: fields.score,
    };
  } catch (error) {
    return { id: c.id, ok: false, status: "error", usd: 0, ms: Date.now() - start, checks: empty, detail: (error as Error).message };
  }
}

async function main() {
  console.log(`Eval analisis peluang — ${EVAL_CASES.length} kasus, model ${model}`);
  if (!confirmed || !apiKey) {
    console.log(
      [
        "",
        "Mode rencana (tidak ada panggilan API).",
        `Setiap kasus = 1 panggilan Claude (effort low). Perkiraan kasar: ±US$0,01–0,03 per kasus, ±US$0,30–1,00 total untuk ${EVAL_CASES.length} kasus.`,
        "Untuk menjalankan: set ANTHROPIC_API_KEY lalu `npm run eval:ai -- --yes`.",
      ].join("\n"),
    );
    if (confirmed && !apiKey) process.exitCode = 1;
    return;
  }

  const llm = claudeClient(apiKey, model);
  const rows: Row[] = [];
  const queue = [...EVAL_CASES];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const row = await runCase(llm, c);
        rows.push(row);
        process.stdout.write(row.status === "ok" ? "." : row.status[0]!.toUpperCase());
      }
    }),
  );
  rows.sort((a, b) => a.id.localeCompare(b.id));
  console.log("\n");

  const pct = (n: number) => `${((n / rows.length) * 100).toFixed(0)}%`;
  const count = (k: keyof Row["checks"]) => rows.filter((r) => r.checks[k]).length;
  const sensitiveCases = EVAL_CASES.filter((c) => c.sensitive).map((c) => c.id);
  const sensitiveCaught = rows.filter((r) => sensitiveCases.includes(r.id) && r.sensitive).length;
  const totalUsd = rows.reduce((n, r) => n + r.usd, 0);

  console.table({
    "Intent benar": `${count("intent")}/${rows.length} (${pct(count("intent"))})`,
    "Niat beli benar": `${count("commercial")}/${rows.length} (${pct(count("commercial"))})`,
    "Match teratas benar": `${count("match")}/${rows.length} (${pct(count("match"))})`,
    "Sensitif benar": `${count("sensitive")}/${rows.length} (${pct(count("sensitive"))})`,
    "Recall sensitif": `${sensitiveCaught}/${sensitiveCases.length}`,
    "Ditolak AI": rows.filter((r) => r.status === "refused").length,
    "Output tidak valid / error": rows.filter((r) => r.status === "invalid" || r.status === "error").length,
    "Estimasi biaya": `US$ ${totalUsd.toFixed(3)}`,
    "Rata-rata latensi": `${Math.round(rows.reduce((n, r) => n + r.ms, 0) / rows.length)} ms`,
  });

  const failures = rows.filter((r) => !Object.values(r.checks).every(Boolean));
  if (failures.length > 0) {
    console.log("Kasus yang meleset:");
    for (const r of failures) {
      const c = EVAL_CASES.find((x) => x.id === r.id)!;
      console.log(`- ${r.id} [${r.status}] intent ${r.intent}/${c.intent}, match ${r.match}/${c.match}, sensitif ${r.sensitive}/${c.sensitive}${r.detail ? ` — ${r.detail}` : ""}`);
    }
  }

  mkdirSync("eval/.out", { recursive: true });
  const file = `eval/.out/results-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify({ model, rows }, null, 2));
  console.log(`\nHasil lengkap: functions/${file}`);
}

await main();
