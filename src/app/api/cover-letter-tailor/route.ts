export const runtime = 'nodejs';
export const maxDuration = 90;

const MAX_LENGTH = 12_000;
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const model = process.env.OLLAMA_RESUME_MODEL ?? 'qwen2.5:3b';

type CoverLetterUpdates = {
  body: string;
  roleTitle?: string;
  companyName?: string;
  subject?: string;
  greeting?: string;
};

function cleanText(value: unknown, max = 6_000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseTailoredUpdates(content: string): CoverLetterUpdates {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const body = cleanText(parsed.body);
    if (body) {
      return {
        body,
        roleTitle: cleanText(parsed.roleTitle, 180),
        companyName: cleanText(parsed.companyName, 180),
        subject: cleanText(parsed.subject, 240),
        greeting: cleanText(parsed.greeting, 120),
      };
    }
  } catch {
    // Older local models sometimes return plain text despite the requested JSON shape.
  }
  if (!trimmed) throw new Error('Ollama returned no tailored letter content.');
  return { body: trimmed };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { body?: unknown; jobDescription?: unknown; roleTitle?: unknown; companyName?: unknown };
    const body = typeof payload.body === 'string' ? payload.body.trim() : '';
    const jobDescription = typeof payload.jobDescription === 'string' ? payload.jobDescription.trim() : '';
    const roleTitle = typeof payload.roleTitle === 'string' ? payload.roleTitle.trim() : '';
    const companyName = typeof payload.companyName === 'string' ? payload.companyName.trim() : '';
    if (!body || !jobDescription) return Response.json({ message: 'Add both a letter body and job description first.' }, { status: 400 });
    if (body.length + jobDescription.length > MAX_LENGTH) return Response.json({ message: 'Keep the letter and job description under 12,000 characters combined.' }, { status: 400 });

    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(75_000),
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        options: { temperature: 0.25, num_ctx: 8192, num_predict: 1000 },
        messages: [
          { role: 'system', content: 'You tailor cover letters. Return valid JSON only, with this exact shape: {"body":"2-4 concise revised paragraphs", "roleTitle":"", "companyName":"", "subject":"", "greeting":""}. Preserve only claims supported by the supplied draft. Emphasize requirements from the job description without inventing metrics, employers, skills, or experience. Use empty strings for roleTitle, companyName, subject, or greeting unless the job description clearly supplies a better value. Do not include a closing or signature.' },
          { role: 'user', content: `Role: ${roleTitle || 'Not provided'}\nCompany: ${companyName || 'Not provided'}\n\nCURRENT LETTER BODY:\n${body}\n\nJOB DESCRIPTION:\n${jobDescription}` },
        ],
      }),
    });
    const result = await response.json() as { message?: { content?: string }; error?: string };
    if (!response.ok) throw new Error(result.error || `Ollama returned HTTP ${response.status}.`);
    const updates = parseTailoredUpdates(result.message?.content ?? '');
    return Response.json({ updates, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to tailor the cover letter with local Ollama.';
    return Response.json({ message }, { status: 503 });
  }
}