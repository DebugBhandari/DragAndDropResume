export const runtime = 'nodejs';
export const maxDuration = 90;

const MAX_LENGTH = 12_000;
const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const model = process.env.OLLAMA_RESUME_MODEL ?? 'qwen2.5:3b';

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
          { role: 'system', content: 'You tailor cover letters. Return only the revised body text, in 2-4 concise paragraphs. Preserve only claims supported by the supplied draft. Emphasize requirements from the job description without inventing metrics, employers, skills, or experience. Do not add a greeting, closing, subject, or signature.' },
          { role: 'user', content: `Role: ${roleTitle || 'Not provided'}\nCompany: ${companyName || 'Not provided'}\n\nCURRENT LETTER BODY:\n${body}\n\nJOB DESCRIPTION:\n${jobDescription}` },
        ],
      }),
    });
    const result = await response.json() as { message?: { content?: string }; error?: string };
    if (!response.ok) throw new Error(result.error || `Ollama returned HTTP ${response.status}.`);
    const tailoredBody = result.message?.content?.trim();
    if (!tailoredBody) throw new Error('Ollama returned no tailored letter content.');
    return Response.json({ body: tailoredBody, model });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to tailor the cover letter with local Ollama.';
    return Response.json({ message }, { status: 503 });
  }
}