import type { ResumeData } from '@/types/resume';

export const runtime = 'nodejs';
export const maxDuration = 90;

const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const model = process.env.OLLAMA_RESUME_MODEL ?? 'qwen2.5:3b';
const MAX_LENGTH = 28_000;

function resumeForTailoring(resume: ResumeData): ResumeData {
  return {
    ...resume,
    photo: {
      ...resume.photo,
      url: resume.photo.url.startsWith('data:') ? '' : resume.photo.url,
    },
  };
}

function parseResume(content: string): ResumeData {
  const json = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('The server AI did not return a tailored résumé format.');
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('The server AI returned invalid résumé JSON.'); }
  if (!value || typeof value !== 'object') throw new Error('The server AI returned an empty résumé.');
  return value as ResumeData;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { resume?: ResumeData; jobDescription?: unknown };
    const jobDescription = typeof payload.jobDescription === 'string' ? payload.jobDescription.trim() : '';
    if (!payload.resume || !jobDescription) return Response.json({ message: 'Add both a résumé and job description first.' }, { status: 400 });
    const source = JSON.stringify(resumeForTailoring(payload.resume));
    if (source.length + jobDescription.length > MAX_LENGTH) return Response.json({ message: 'Keep the résumé and job description under 28,000 characters combined.' }, { status: 400 });
    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(75_000),
      body: JSON.stringify({ model, stream: false, think: false, options: { temperature: 0.2, num_ctx: 16384, num_predict: 4096 }, messages: [
        { role: 'system', content: 'You tailor structured résumés. Return ONLY one valid JSON object matching CURRENT RESUME exactly: retain every existing object key, id, visible value, sectionOrder, layout, style, and photo. Improve only wording in personalInfo.summary, experience.descriptionBullets/description, projects.descriptionBullets/description, education.description, volunteer.description, award.description, and skills when supported by CURRENT RESUME and JOB DESCRIPTION. Do not invent employers, dates, credentials, technologies, metrics, or experience. Keep all ids unchanged and preserve the full complete résumé.' },
        { role: 'user', content: `CURRENT RESUME JSON:\n${source}\n\nJOB DESCRIPTION:\n${jobDescription}` },
      ] }),
    });
    const result = await response.json() as { message?: { content?: string }; error?: string };
    if (!response.ok) throw new Error(result.error || `Server AI returned HTTP ${response.status}.`);
    const resume = parseResume(result.message?.content ?? '');
    return Response.json({ resume, model });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : 'Unable to tailor the résumé with server AI.' }, { status: 503 });
  }
}