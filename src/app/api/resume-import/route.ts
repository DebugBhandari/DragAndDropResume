import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ResumeImportDraft } from '@/types/resume';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const encoder = new TextEncoder();
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 3;
const MAX_IMPORTED_PHOTO_BYTES = 1_000_000;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
let aiRefinementInFlight = false;

type ImportEvent =
  | { type: 'progress'; message: string }
  | { type: 'draft'; draft: ResumeImportDraft; source: 'extracted' | 'ai-partial' | 'ai' | 'photo' }
  | { type: 'complete'; message: string }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string };

function text(value: unknown, max = 500) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function array(value: unknown) { return Array.isArray(value) ? value : []; }
function validLevel(value: string, levels: readonly string[], fallback: string) { return levels.includes(value) ? value : fallback; }
function namedRows(value: unknown) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([name, detail]) => detail && typeof detail === 'object' ? { name, ...(detail as Record<string, unknown>) } : { name, detail });
  return [];
}
function emptyDraft(): ResumeImportDraft {
  return { personalInfo: { fullName: '', email: '', phone: '', location: '', linkedin: '', website: '', summary: '' }, experience: [], projects: [], education: [], skills: [], languages: [], certificates: [], warnings: [] };
}
function sanitizeDraft(value: unknown): ResumeImportDraft {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const personal = raw.personalInfo && typeof raw.personalInfo === 'object' ? raw.personalInfo as Record<string, unknown> : {};
  return {
    personalInfo: { fullName: text(personal.fullName ?? personal.name, 120), email: text(personal.email, 160), phone: text(personal.phone, 80), location: text(personal.location, 160), linkedin: text(personal.linkedin, 240), website: text(personal.website, 240), summary: text(personal.summary, 1200) },
    experience: array(raw.experience).slice(0, 12).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const bullets = array(row.descriptionBullets).map((bullet) => text(bullet, 360)).filter(Boolean).slice(0, 10);
      const description = text(row.description, 1200);
      return { company: text(row.company, 180), position: text(row.position, 180), startDate: text(row.startDate, 60), endDate: text(row.endDate, 60), description, descriptionBullets: bullets.length ? bullets : description ? [description] : [] };
    }).filter((item) => item.company || item.position),
    projects: array(raw.projects).slice(0, 12).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const bullets = array(row.descriptionBullets).map((bullet) => text(bullet, 360)).filter(Boolean).slice(0, 10);
      const description = text(row.description, 1200);
      return { name: text(row.name, 180), description, descriptionBullets: bullets.length ? bullets : description ? [description] : [], completionDate: text(row.completionDate, 60), technologies: text(row.technologies, 400), link: text(row.link, 240) };
    }).filter((item) => item.name || item.descriptionBullets.length),
    education: array(raw.education).slice(0, 10).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { institution: text(row.institution, 180), degree: text(row.degree, 180), field: text(row.field, 180), startDate: text(row.startDate, 60), endDate: text(row.endDate, 60), description: text(row.description, 800) };
    }).filter((item) => item.institution || item.degree),
    skills: namedRows(raw.skills).slice(0, 40).map((item) => {
      const row: Record<string, unknown> = item && typeof item === 'object' ? item as Record<string, unknown> : { name: item };
      return { name: text(row.name, 80), level: validLevel(text(row.level ?? row.detail, 20), ['Expert', 'Advanced', 'Intermediate', 'Beginner'], 'Intermediate') as 'Expert' | 'Advanced' | 'Intermediate' | 'Beginner' };
    }).filter((item) => item.name),
    languages: namedRows(raw.languages).slice(0, 15).map((item) => {
      const row: Record<string, unknown> = item && typeof item === 'object' ? item as Record<string, unknown> : { name: item };
      return { name: text(row.name, 80), proficiency: validLevel(text(row.proficiency ?? row.detail, 20), ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Beginner'], 'Intermediate') as 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Beginner' };
    }).filter((item) => item.name),
    certificates: array(raw.certificates).slice(0, 20).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { name: text(row.name, 180), issuer: text(row.issuer, 180), date: text(row.date, 60), link: text(row.link, 240) };
    }).filter((item) => item.name),
    warnings: array(raw.warnings).map((warning) => text(warning, 240)).filter(Boolean).slice(0, 8),
  };
}

function normalizeHeading(value: string) { return value.toLowerCase().replace(/[^a-z]/g, ''); }
function isHeading(value: string, candidates: string[]) { const heading = normalizeHeading(value); return candidates.some((candidate) => heading === candidate || heading.startsWith(candidate)); }
function inferDraftFromText(rawText: string): ResumeImportDraft {
  const draft = emptyDraft();
  const lines = rawText.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const joined = lines.join('\n');
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
  const linkedIn = joined.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|]+/i)?.[0] ?? '';
  const website = [...joined.matchAll(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s|]*)?/gi)].map((match) => match[0]).find((value) => !value.toLowerCase().includes('linkedin.com')) ?? '';
  const phone = joined.match(/(?:\+?\d[\d().\s-]{7,}\d)/)?.[0] ?? '';
  const fullName = lines.find((line) => line.length >= 3 && line.length <= 80 && !/@/.test(line) && !/https?:\/\//i.test(line) && !isHeading(line, ['experience', 'education', 'skills', 'languages', 'summary'])) ?? '';
  draft.personalInfo = { fullName, email, phone: phone.replace(/\s+/g, ' ').trim(), location: '', linkedin: linkedIn, website, summary: '' };
  const sections: Record<string, string[]> = { experience: [], projects: [], education: [], skills: [], languages: [], certificates: [], summary: [] };
  let current = '';
  for (const line of lines) {
    if (isHeading(line, ['experience', 'workexperience', 'employment', 'professionalexperience', 'careersummary', 'workhistory'])) current = 'experience';
    else if (isHeading(line, ['projects', 'projectexperience', 'selectedprojects', 'personalprojects', 'keyprojects'])) current = 'projects';
    else if (isHeading(line, ['education', 'academicbackground', 'qualifications'])) current = 'education';
    else if (isHeading(line, ['skills', 'technicalskills', 'corecompetencies', 'competencies', 'technologies', 'toolbox'])) current = 'skills';
    else if (isHeading(line, ['languages', 'language'])) current = 'languages';
    else if (isHeading(line, ['certificates', 'certifications', 'licenses', 'licences', 'credentials'])) current = 'certificates';
    else if (isHeading(line, ['summary', 'profile', 'professionalprofile', 'aboutme', 'objective'])) current = 'summary';
    else if (current) sections[current].push(line);
  }
  draft.personalInfo.summary = sections.summary.join(' ').slice(0, 1200);
  draft.skills = [...new Set(sections.skills.join(' ').split(/[|,;•·]+/).map((value) => value.replace(/^[-–—]\s*/, '').trim()).filter((value) => value.length >= 2 && value.length <= 80))].slice(0, 40).map((name) => ({ name, level: 'Intermediate' }));
  draft.languages = [...new Set(sections.languages.join(' ').split(/[|,;•·]+/).map((value) => value.replace(/^[-–—]\s*/, '').trim()).filter((value) => value.length >= 2 && value.length <= 80))].slice(0, 15).map((value) => ({ name: value.replace(/\s*[-–—:]\s*(native|fluent|advanced|intermediate|beginner).*$/i, ''), proficiency: (value.match(/native|fluent|advanced|intermediate|beginner/i)?.[0] ?? 'Intermediate').replace(/^./, (letter) => letter.toUpperCase()) as 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Beginner' }));
  draft.warnings.push('Contact details, skills, and languages are ready. Work history, projects, education, and certificates are being structured by AI to avoid mixing PDF columns or entries.');
  return draft;
}
function compactTextForAi(rawText: string) {
  const compactLines: string[] = [];
  let previous = '';
  for (const line of rawText.replace(/\r/g, '').split('\n').map((item) => item.trim()).filter(Boolean)) {
    if (line === previous) continue;
    previous = line;
    compactLines.push(line.slice(0, 500));
    if (compactLines.join('\n').length >= 12_000) break;
  }
  return compactLines.join('\n').slice(0, 12_000);
}
type StreamRecordType = 'personalInfo' | 'experience' | 'projects' | 'education' | 'skills' | 'languages' | 'certificates' | 'warning';
type StreamRecord = { type?: StreamRecordType; item?: unknown; message?: unknown };
function recordKey(type: Exclude<StreamRecordType, 'personalInfo' | 'warning'>, item: Record<string, unknown>) {
  if (type === 'experience') return [item.company, item.position, item.startDate, item.endDate].map(String).join('|').toLowerCase();
  if (type === 'projects') return [item.name, item.completionDate, item.link].map(String).join('|').toLowerCase();
  if (type === 'education') return [item.institution, item.degree, item.startDate, item.endDate].map(String).join('|').toLowerCase();
  if (type === 'skills' || type === 'languages') return String(item.name ?? '').toLowerCase();
  return [item.name, item.issuer, item.date].map(String).join('|').toLowerCase();
}
function applyStreamRecord(draft: ResumeImportDraft, record: StreamRecord) {
  if (!record.type) return false;
  if (record.type === 'warning') {
    const warning = text(record.message, 240);
    if (!warning || draft.warnings.includes(warning)) return false;
    draft.warnings = [...draft.warnings, warning].slice(0, 8);
    return true;
  }
  if (record.type === 'personalInfo') {
    const partial = sanitizeDraft({ personalInfo: record.item }).personalInfo;
    const populated = Object.fromEntries(Object.entries(partial).filter(([, value]) => Boolean(value)));
    if (!Object.keys(populated).length) return false;
    const changed = Object.entries(populated).some(([key, value]) => draft.personalInfo[key as keyof typeof draft.personalInfo] !== value);
    draft.personalInfo = { ...draft.personalInfo, ...populated };
    return changed;
  }
  const section = record.type as Exclude<StreamRecordType, 'personalInfo' | 'warning'>;
  const parsed = sanitizeDraft({ [section]: [record.item] })[section];
  const item = parsed[0];
  if (!item) return false;
  const key = recordKey(section, item as Record<string, unknown>);
  if (!key || draft[section].some((existing) => recordKey(section, existing as Record<string, unknown>) === key)) return false;
  draft[section] = [...draft[section], item] as never;
  return true;
}
function takeCompleteStreamRecords(buffer: string) {
  const records: StreamRecord[] = [];
  let start = -1; let depth = 0; let inString = false; let escaped = false; let consumed = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const character = buffer[index];
    if (start < 0) { if (character === '{') { start = index; depth = 1; } else consumed = index + 1; continue; }
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; continue; }
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) {
      try { records.push(JSON.parse(buffer.slice(start, index + 1)) as StreamRecord); } catch { /* Ignore an invalid model record and continue. */ }
      consumed = index + 1; start = -1;
    }
  }
  return { records, remainder: start >= 0 ? buffer.slice(start) : buffer.slice(consumed) };
}
async function streamDraftWithAi(extractedText: string, onRecord: (record: StreamRecord) => void) {
  if (aiRefinementInFlight) throw new Error('AI cleanup is already processing another résumé. Your quick preview is ready; retry this import after that cleanup finishes.');
  aiRefinementInFlight = true;
  try {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434'}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(285_000),
      body: JSON.stringify({ model: process.env.OLLAMA_RESUME_MODEL ?? 'qwen2.5:1.5b', stream: true, think: false, options: { temperature: 0, num_ctx: 8192, num_predict: 1800 }, messages: [
        { role: 'system', content: 'Extract résumé facts exactly. Output newline-delimited JSON only: one complete object per line, no markdown. Each object must use exactly one type: personalInfo, experience, projects, education, skills, languages, certificates, warning. Use {"type":"personalInfo","item":{...}} once when possible. Use one object per work role/project/etc. Never merge separate entries, dates, employers, titles, bullets, or technologies. Keep source order. Experience item: company, position, startDate, endDate, descriptionBullets. Projects item: name, completionDate, technologies, link, descriptionBullets. Education item: institution, degree, field, startDate, endDate, description. Skills item: name, level. Languages item: name, proficiency. Certificates item: name, issuer, date, link. Never invent facts.' },
        { role: 'user', content: compactTextForAi(extractedText) },
      ] }),
    });
    if (!response.ok) throw new Error('The local résumé model is unavailable.');
    if (!response.body) throw new Error('The local résumé model did not return a stream.');
    const reader = response.body.getReader(); const decoder = new TextDecoder();
    let ollamaBuffer = ''; let recordBuffer = ''; let records = 0;
    const processContent = (content: string) => {
      recordBuffer += content;
      const extracted = takeCompleteStreamRecords(recordBuffer);
      recordBuffer = extracted.remainder;
      for (const record of extracted.records) { onRecord(record); records += 1; }
    };
    while (true) {
      const { value, done } = await reader.read();
      ollamaBuffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = ollamaBuffer.split('\n'); ollamaBuffer = lines.pop() ?? '';
      for (const line of lines) {
        try { const chunk = JSON.parse(line) as { message?: { content?: string } }; if (chunk.message?.content) processContent(chunk.message.content); } catch { /* Ignore malformed transport chunks. */ }
      }
      if (done) break;
    }
    if (ollamaBuffer.trim()) { try { const chunk = JSON.parse(ollamaBuffer) as { message?: { content?: string } }; if (chunk.message?.content) processContent(chunk.message.content); } catch { /* Ignore malformed final transport chunk. */ } }
    const finalRecords = takeCompleteStreamRecords(recordBuffer).records;
    for (const record of finalRecords) { onRecord(record); records += 1; }
    if (!records) throw new Error('The local résumé model did not return readable structured details.');
  } finally {
    aiRefinementInFlight = false;
  }
}

type EmbeddedPdfImage = { page: number; index: number; width: number; height: number };
function findEmbeddedPdfImages(output: string) {
  return output.split('\n').flatMap((line): EmbeddedPdfImage[] => {
    const columns = line.trim().split(/\s+/); const width = Number(columns[3]); const height = Number(columns[4]);
    return /^\d+$/.test(columns[0] ?? '') && /^\d+$/.test(columns[1] ?? '') && Number.isFinite(width) && Number.isFinite(height) ? [{ page: Number(columns[0]), index: Number(columns[1]), width, height }] : [];
  });
}
async function extractEmbeddedProfilePhoto(pdfPath: string, workspace: string) {
  const prefix = join(workspace, 'embedded-image');
  const { stdout } = await execFileAsync('pdfimages', ['-list', pdfPath], { timeout: 12_000, maxBuffer: 1024 * 1024 });
  const candidate = findEmbeddedPdfImages(stdout).filter(({ page, width, height }) => { const ratio = width / height; return page === 1 && width >= 100 && height >= 100 && width * height >= 20_000 && ratio >= 0.55 && ratio <= 1.5; }).sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
  if (!candidate) return '';
  await execFileAsync('pdfimages', ['-f', '1', '-l', '1', '-png', pdfPath, prefix], { timeout: 20_000, maxBuffer: 1024 * 1024 });
  const files = (await readdir(workspace)).filter((name) => /^embedded-image-\d+\.png$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const position = findEmbeddedPdfImages(stdout).filter((image) => image.page === 1).findIndex((image) => image.index === candidate.index);
  const fileName = files[position]; if (!fileName) return '';
  const imagePath = join(workspace, fileName); const info = await stat(imagePath);
  return info.size > 0 && info.size <= MAX_IMPORTED_PHOTO_BYTES ? `data:image/png;base64,${(await readFile(imagePath)).toString('base64')}` : '';
}
async function ocrImage(path: string) { const { stdout } = await execFileAsync('tesseract', [path, 'stdout', '--oem', '1', '--psm', '3', '-l', 'eng'], { timeout: 60_000, maxBuffer: 2_000_000 }); return stdout; }
async function extractDocument(path: string, type: string, workspace: string, progress: (message: string) => void) {
  if (type !== 'application/pdf') { progress('Scanning the image with OCR…'); return ocrImage(path); }
  progress('Extracting text from the PDF…');
  const { stdout } = await execFileAsync('pdftotext', ['-layout', path, '-'], { timeout: 30_000, maxBuffer: 2_000_000 });
  if (stdout.replace(/\s/g, '').length >= 100) return stdout;
  progress('This looks like a scanned PDF. Preparing OCR…');
  const prefix = join(workspace, 'page');
  await execFileAsync('pdftoppm', ['-png', '-r', '150', '-f', '1', '-l', String(MAX_PDF_PAGES), path, prefix], { timeout: 60_000 });
  const pages: string[] = [];
  for (let index = 1; index <= MAX_PDF_PAGES; index += 1) {
    progress(`Reading scanned page ${index} of ${MAX_PDF_PAGES}…`);
    try { const page = await ocrImage(`${prefix}-${index}.png`); if (page.trim()) pages.push(page); if (pages.join('').replace(/\s/g, '').length >= 1_500) break; } catch { /* Continue with the remaining pages. */ }
  }
  return pages.join('\n\n--- Page break ---\n\n');
}

export async function POST(request: Request) {
  let formData: FormData;
  try { formData = await request.formData(); } catch { return Response.json({ message: 'Upload a PDF, PNG, or JPEG file.' }, { status: 400 }); }
  const file = formData.get('file');
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size === 0 || file.size > MAX_BYTES) return Response.json({ message: 'Upload a PDF, PNG, or JPEG no larger than 10 MB.' }, { status: 400 });
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ImportEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const startedAt = performance.now();
      const logStage = (stage: string) => console.info(`[resume-import] ${stage}: ${Math.round(performance.now() - startedAt)}ms`);
      let workspace = '';
      try {
        emit({ type: 'progress', message: 'Saving your file securely for processing…' });
        workspace = await mkdtemp(join(tmpdir(), 'resume-import-')); await mkdir(workspace, { recursive: true });
        const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
        const sourcePath = join(workspace, `source.${extension}`); await writeFile(sourcePath, Buffer.from(await file.arrayBuffer()));
        logStage('upload write');
        const photoPromise = file.type === 'application/pdf'
          ? (() => {
            emit({ type: 'progress', message: 'Looking for an embedded profile photo while text is extracted…' });
            return extractEmbeddedProfilePhoto(sourcePath, workspace)
              .then((photo) => { logStage('photo extraction'); emit({ type: 'progress', message: photo ? 'Profile photo downloaded and ready to review.' : 'No embedded profile photo was found.' }); return photo; })
              .catch(() => { logStage('photo extraction unavailable'); emit({ type: 'progress', message: 'Profile photo could not be extracted; continuing with text import.' }); return ''; });
          })()
          : Promise.resolve('');
        const extractedText = (await extractDocument(sourcePath, file.type, workspace, (message) => emit({ type: 'progress', message }))).trim();
        logStage('text extraction');
        if (extractedText.length < 30) throw new Error('No readable résumé text was found in this file.');
        emit({ type: 'progress', message: 'Building a quick preview from the extracted text…' });
        let draft = inferDraftFromText(extractedText); logStage('deterministic draft'); emit({ type: 'draft', draft, source: 'extracted' });
        emit({ type: 'progress', message: 'Your preview is ready. Reading résumé records with local AI…' });
        let streamedRecords = 0;
        const aiDraftPromise = streamDraftWithAi(extractedText, (record) => {
          if (!applyStreamRecord(draft, record)) return;
          streamedRecords += 1;
          const label = record.type === 'projects' ? 'project' : record.type === 'skills' ? 'skill' : record.type === 'languages' ? 'language' : record.type === 'certificates' ? 'certificate' : record.type === 'personalInfo' ? 'personal details' : record.type ?? 'detail';
          emit({ type: 'progress', message: `Detected ${label}${record.type === 'personalInfo' ? '' : ` ${streamedRecords}`}…` });
          emit({ type: 'draft', draft: { ...draft }, source: 'ai-partial' });
        });
        const photoUpdatePromise = photoPromise.then((photoDataUrl) => {
          if (!photoDataUrl) return;
          draft = { ...draft, photoDataUrl };
          emit({ type: 'draft', draft, source: 'photo' });
        });
        try {
          await aiDraftPromise;
          logStage('AI normalization and sanitization');
          emit({ type: 'draft', draft, source: 'ai' });
          emit({ type: 'complete', message: `AI cleanup is complete. ${streamedRecords} structured detail${streamedRecords === 1 ? '' : 's'} arrived progressively for review.` });
        }
        catch (error) { const message = error instanceof Error ? error.message : 'AI cleanup could not finish.'; emit({ type: 'warning', message: `${message} The quick extraction remains available to review.` }); emit({ type: 'complete', message: 'Quick extraction is ready to review.' }); }
        await photoUpdatePromise;
      } catch (error) { emit({ type: 'error', message: error instanceof Error ? error.message : 'Unable to import this résumé right now.' }); }
      finally { if (workspace) await rm(workspace, { recursive: true, force: true }); logStage('complete'); controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}