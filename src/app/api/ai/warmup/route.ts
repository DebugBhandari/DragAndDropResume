import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 35;

const execFileAsync = promisify(execFile);
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const model = process.env.OLLAMA_RESUME_MODEL ?? "qwen2.5:3b";
const doclingBin = process.env.DOCLING_BIN ?? "docling";
const WARMUP_INTERVAL_MS = 10 * 60 * 1_000;

let lastWarmupAt = 0;
let warmupInFlight: Promise<WarmupResult> | null = null;

type WarmupResult = {
  ollama: "ready" | "unavailable";
  docling: "ready" | "unavailable";
};

async function ensureOllamaService() {
  await execFileAsync("systemctl", ["start", "ollama"], { timeout: 15_000 });
}

async function warmResources(): Promise<WarmupResult> {
  const [ollama, docling] = await Promise.all([
    (async (): Promise<WarmupResult["ollama"]> => {
      try {
        await ensureOllamaService();
        const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(30_000),
          body: JSON.stringify({
            model,
            prompt: "",
            stream: false,
            keep_alive: "15m",
            options: { num_predict: 0 },
          }),
        });
        return response.ok ? "ready" : "unavailable";
      } catch {
        return "unavailable";
      }
    })(),
    (async (): Promise<WarmupResult["docling"]> => {
      try {
        await execFileAsync(doclingBin, ["--version"], { timeout: 12_000, maxBuffer: 64 * 1024 });
        return "ready";
      } catch {
        return "unavailable";
      }
    })(),
  ]);

  lastWarmupAt = Date.now();
  return { ollama, docling };
}

export async function POST() {
  const now = Date.now();
  if (warmupInFlight) return Response.json({ ok: true, status: "warming" }, { status: 202 });
  if (now - lastWarmupAt < WARMUP_INTERVAL_MS) return Response.json({ ok: true, status: "ready", cached: true });

  warmupInFlight = warmResources();
  try {
    const resources = await warmupInFlight;
    return Response.json({ ok: resources.ollama === "ready" && resources.docling === "ready", status: "ready", resources });
  } finally {
    warmupInFlight = null;
  }
}