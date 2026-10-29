export const runtime = "nodejs";
export const maxDuration = 90;

const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const model = process.env.OLLAMA_RESUME_MODEL ?? "qwen2.5:3b";
const MAX_PROMPT_LENGTH = 4_000;

type OllamaChatResponse = {
  message?: { content?: string };
  error?: string;
};

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { message?: unknown };
    const message = typeof payload.message === "string" ? payload.message.trim() : "";

    if (!message) {
      return Response.json({ message: "Enter a message first." }, { status: 400 });
    }
    if (message.length > MAX_PROMPT_LENGTH) {
      return Response.json({ message: `Messages must be ${MAX_PROMPT_LENGTH.toLocaleString()} characters or fewer.` }, { status: 400 });
    }

    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(75_000),
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: "You are a concise diagnostic assistant for a résumé builder. Answer plainly and do not invent server status." },
          { role: "user", content: message },
        ],
      }),
    });
    const body = await response.text();

    let result: OllamaChatResponse;
    try {
      result = JSON.parse(body) as OllamaChatResponse;
    } catch {
      throw new Error(`Ollama returned HTTP ${response.status} with a non-JSON response.`);
    }

    if (!response.ok) {
      throw new Error(result.error || `Ollama returned HTTP ${response.status}.`);
    }

    const reply = result.message?.content?.trim();
    if (!reply) throw new Error("Ollama returned no message content.");

    return Response.json({ reply, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to contact local Ollama.";
    return Response.json({ message }, { status: 503 });
  }
}