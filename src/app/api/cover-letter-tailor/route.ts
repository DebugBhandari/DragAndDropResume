export const runtime = 'nodejs';
export const maxDuration = 90;

const MAX_LENGTH = 12_000;
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const model = process.env.OLLAMA_RESUME_MODEL ?? 'qwen2.5:3b';
const encoder = new TextEncoder();

type TailorEvent =
  | { type: 'stage'; stage: 'validating' | 'server-ai' | 'review'; detail: string }
  | { type: 'result'; body: string; model: string }
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

function parseTailoredBody(content: string, originalBody: string) {
  const trimmed = content.trim().replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/i, '');
  if (!trimmed) throw new Error('Ollama returned no tailored letter content.');
  return assertTailoredBody(trimmed, originalBody);
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
          body: JSON.stringify({ model, stream: false, think: false, options: { temperature: 0.25, num_ctx: 8192, num_predict: 2048 }, messages: [
            { role: 'system', content: 'You tailor cover letters. Return ONLY a COMPLETE replacement for the entire CURRENT LETTER BODY as plain text. Rewrite every part of the draft into 2 to 4 substantive paragraphs and preserve roughly the same amount of detail and length (never return a summary, a single paragraph, an excerpt, or only changed sentences). Do not return JSON, labels, explanations, instructions, placeholders, Markdown fences, a greeting, a closing, or a signature. Preserve only claims supported by the supplied draft. Emphasize requirements from the job description without inventing metrics, employers, skills, or experience.' },
            { role: 'user', content: `Role: ${roleTitle || 'Not provided'}\nCompany: ${companyName || 'Not provided'}\n\nCURRENT LETTER BODY:\n${body}\n\nJOB DESCRIPTION:\n${jobDescription}` },
          ] }),
        });
        const result = await response.json() as { message?: { content?: string }; error?: string };
        if (!response.ok) throw new Error(result.error || `Server AI returned HTTP ${response.status}.`);
        const tailoredBody = parseTailoredBody(result.message?.content ?? '', body);
        emit({ type: 'stage', stage: 'review', detail: 'Your complete revised body is ready to review and apply.' });
        emit({ type: 'result', body: tailoredBody, model });
      } catch (error) {
        emit({ type: 'error', message: error instanceof Error ? error.message : 'Unable to tailor the cover letter with server AI.' });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}