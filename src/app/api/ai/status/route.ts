export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const model = process.env.OLLAMA_RESUME_MODEL ?? "qwen2.5:3b";

type OllamaTagsResponse = {
  models?: Array<{ name?: string; model?: string }>;
};

export async function GET() {
  try {
    const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const body = await response.text();

    if (!response.ok) {
      return Response.json(
        { ok: false, model, installed: false, error: `Ollama returned HTTP ${response.status}.` },
        { status: 503 },
      );
    }

    let data: OllamaTagsResponse;
    try {
      data = JSON.parse(body) as OllamaTagsResponse;
    } catch {
      return Response.json(
        { ok: false, model, installed: false, error: "Ollama returned an invalid response." },
        { status: 503 },
      );
    }

    const installed = (data.models ?? []).some((item) => item.name === model || item.model === model);
    return Response.json({ ok: true, model, installed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach local Ollama.";
    return Response.json({ ok: false, model, installed: false, error: message }, { status: 503 });
  }
}