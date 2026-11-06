export const runtime = 'nodejs';
export const maxDuration = 90;

const MAX_LENGTH = 12_000;
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const model = process.env.OLLAMA_RESUME_MODEL ?? 'qwen2.5:3b';
const encoder = new TextEncoder();

type TailorEvent =
  | { type: 'stage'; stage: 'validating' | 'server-ai' | 'applying'; detail: string }
  | { type: 'result'; body: string; model: string }
  | { type: 'error'; message: string };

function assertTailoredBody(body: string) {
  const normalized = body.toLowerCase().replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (
    normalized.length < 80
    || /^(?:2|two) (?:to )?4 concise revised paragraphs?\.?$/.test(normalized)
    || /^(?:revised|tailored) (?:cover )?letter (?:body|paragraphs?)\.?$/.test(normalized)
    || /^(?:write|provide|insert) .*(?:paragraph|letter|body)/.test(normalized)
  ) {
    throw new Error('The server AI returned an instruction instead of a revised letter. Your current letter was not changed; please try again.');
  }
  return body;
}

function parseTailoredBody(content: string) {
  const trimmed = content.trim().replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/i, '');
  if (!trimmed) throw new Error('Ollama returned no tailored letter content.');
  return assertTailoredBody(trimmed);
}

export async function POST(request: Request) {
  let payload: { body?: unknown; jobDescription?: unknown; roleTitle?: unknown; companyName?: unknown };
  try { payload = await request.json() as typeof payload; } catch { return Response.json({ message: 'Add both a letter body and job description first.' }, { status: 400 }); }
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  const jobDescription = typeof payload.jobDescription === 'string' ? payload.jobDescription.trim() : '';
  const roleTitle = typeof payload.roleTitle === 'string' ? payload.roleTitle.trim() : '';
  const companyName = typeof payload.companyName === 'string' ? payload.companyName.trim() : '';
  if (!body || !jobDescription) return Response.json({ message: 'Add both a letter body and job description first.' }, { status: 400 });
  if (body.length + jobDescription.length > MAX_LENGTH) return Response.json({ message: 'Keep the letter and job description under 12,000 characters combined.' }, { status: 400 });

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: TailorEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        emit({ type: 'stage', stage: 'validating', detail: 'Preparing your current letter and pasted job requirements…' });
        emit({ type: 'stage', stage: 'server-ai', detail: 'The server AI is tailoring the letter to the job requirements…' });
        const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(75_000),
          body: JSON.stringify({ model, stream: false, think: false, options: { temperature: 0.25, num_ctx: 8192, num_predict: 1000 }, messages: [
            { role: 'system', content: 'You tailor cover letters. Return ONLY the complete rewritten letter body as plain text: 2 to 4 substantive paragraphs, at least 80 characters. Do not return JSON, labels, instructions, placeholders, Markdown fences, a greeting, a closing, or a signature. Preserve only claims supported by the supplied draft. Emphasize requirements from the job description without inventing metrics, employers, skills, or experience.' },
            { role: 'user', content: `Role: ${roleTitle || 'Not provided'}\nCompany: ${companyName || 'Not provided'}\n\nCURRENT LETTER BODY:\n${body}\n\nJOB DESCRIPTION:\n${jobDescription}` },
          ] }),
        });
        const result = await response.json() as { message?: { content?: string }; error?: string };
        if (!response.ok) throw new Error(result.error || `Server AI returned HTTP ${response.status}.`);
        const tailoredBody = parseTailoredBody(result.message?.content ?? '');
        emit({ type: 'stage', stage: 'applying', detail: 'Applying the revised letter to your current draft…' });
        emit({ type: 'result', body: tailoredBody, model });
      } catch (error) {
        emit({ type: 'error', message: error instanceof Error ? error.message : 'Unable to tailor the cover letter with server AI.' });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}