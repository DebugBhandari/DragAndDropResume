export const runtime = 'nodejs';
export const maxDuration = 90;

const MAX_LENGTH = 12_000;
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const model = process.env.OLLAMA_RESUME_MODEL ?? 'qwen2.5:3b';
const encoder = new TextEncoder();

type TailorEvent =
  | { type: 'stage'; stage: 'validating' | 'server-ai' | 'review'; detail: string }
  | { type: 'result'; body: string; senderName: string; senderEmail: string; senderPhone: string; senderLocation: string; roleTitle: string; companyName: string; model: string }
  | { type: 'error'; message: string };

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function assertTailoredBody(body: string, originalBody: string) {
  const normalized = body.toLowerCase().replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
  const minimumWords = Math.max(80, Math.floor(wordCount(originalBody) * 0.6));
  if (
    wordCount(body) < minimumWords
    || /^(?:2|two) (?:to )?4 concise revised paragraphs?\.?$/.test(normalized)
    || /^(?:revised|tailored) (?:cover )?letter (?:body|paragraphs?)\.?$/.test(normalized)
    || /^(?:write|provide|insert) .*(?:paragraph|letter|body)/.test(normalized)
  ) {
    throw new Error(`The server AI returned an incomplete letter body. It must rewrite the full letter with at least ${minimumWords} words; your current letter was not changed.`);
  }
  return body;
}

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function parseTailoredResult(content: string, originalBody: string) {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const json = trimmed.match(/\{[\s\S]*\}/)?.[0] ?? '';
  if (!json) throw new Error('The server AI did not return the tailored letter format.');
  let result: { body?: unknown; senderName?: unknown; senderEmail?: unknown; senderPhone?: unknown; senderLocation?: unknown; roleTitle?: unknown; companyName?: unknown };
  try { result = JSON.parse(json) as typeof result; } catch { throw new Error('The server AI returned an invalid tailored letter format.'); }
  return {
    body: assertTailoredBody(text(result.body, MAX_LENGTH), originalBody),
    senderName: text(result.senderName, 160),
    senderEmail: text(result.senderEmail, 160),
    senderPhone: text(result.senderPhone, 80),
    senderLocation: text(result.senderLocation, 160),
    roleTitle: text(result.roleTitle, 160),
    companyName: text(result.companyName, 160),
  };
}

export async function POST(request: Request) {
  let payload: { body?: unknown; jobDescription?: unknown; senderName?: unknown; senderEmail?: unknown; senderPhone?: unknown; senderLocation?: unknown };
  try { payload = await request.json() as typeof payload; } catch { return Response.json({ message: 'Add both a letter body and job description first.' }, { status: 400 }); }
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  const jobDescription = typeof payload.jobDescription === 'string' ? payload.jobDescription.trim() : '';
  const senderName = text(payload.senderName, 160);
  const senderEmail = text(payload.senderEmail, 160);
  const senderPhone = text(payload.senderPhone, 80);
  const senderLocation = text(payload.senderLocation, 160);
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
          body: JSON.stringify({ model, stream: false, think: false, options: { temperature: 0.25, num_ctx: 8192, num_predict: 2048 }, messages: [
            { role: 'system', content: 'You tailor cover letters. Return ONLY valid JSON with exactly these string fields: {"body":"...","senderName":"...","senderEmail":"...","senderPhone":"...","senderLocation":"...","roleTitle":"...","companyName":"..."}. body must be a COMPLETE replacement for the entire CURRENT LETTER BODY: rewrite every part into 2 to 4 substantive paragraphs with roughly the same detail and length. Never return a summary, excerpt, or only changed sentences. Copy senderName, senderEmail, senderPhone, and senderLocation from CURRENT LETTERHEAD exactly; use an empty string only if that supplied field is empty. Detect roleTitle and companyName only from the JOB DESCRIPTION; use an empty string when either is not stated. Do not invent facts. The body must not include a greeting, closing, signature, labels, or Markdown.' },
            { role: 'user', content: `CURRENT LETTERHEAD:\nName: ${senderName}\nEmail: ${senderEmail}\nPhone: ${senderPhone}\nLocation: ${senderLocation}\n\nCURRENT LETTER BODY:\n${body}\n\nJOB DESCRIPTION:\n${jobDescription}` },
          ] }),
        });
        const result = await response.json() as { message?: { content?: string }; error?: string };
        if (!response.ok) throw new Error(result.error || `Server AI returned HTTP ${response.status}.`);
        const tailored = parseTailoredResult(result.message?.content ?? '', body);
        emit({ type: 'stage', stage: 'review', detail: 'The tailored body and detected letterhead details are ready to choose.' });
        emit({ type: 'result', ...tailored, model });
      } catch (error) {
        emit({ type: 'error', message: error instanceof Error ? error.message : 'Unable to tailor the cover letter with server AI.' });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}