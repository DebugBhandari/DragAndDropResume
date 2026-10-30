import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ResumeImportDraft } from '@/types/resume';

export const runtime = 'nodejs';
export const maxDuration = 240;

const execFileAsync = promisify(execFile);
const encoder = new TextEncoder();
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 3;
const MAX_IMPORTED_PHOTO_BYTES = 1_000_000;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

type ImportEvent =
  | { type: 'progress'; message: string }
  | { type: 'draft'; draft: ResumeImportDraft; source: 'extracted' | 'ai' | 'photo' }
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
function linesToBullets(lines: string[]) {
  return lines.map((line) => line.replace(/^[•·▪◦*-]\s*/, '').trim()).filter(Boolean).slice(0, 10);
}
function splitSectionEntries(lines: string[]) {
  const entries: string[][] = [];
  let current: string[] = [];
  for (const line of lines) {
    const startsEntry = current.length > 0 && (/\b(?:19|20)\d{2}\b/.test(line) || (/^[A-Z][^.!?]{2,90}$/.test(line) && !/^[•·▪◦*-]/.test(line)));
    if (startsEntry) { entries.push(current); current = [line]; }
    else current.push(line);
  }
  if (current.length) entries.push(current);
  return entries.filter((entry) => entry.some(Boolean));
}
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
  const dateRange = /((?:[A-Z][a-z]{2,8}\.?\s*)?\d{4}|\d{1,2}[\/.]\d{4})\s*(?:-|–|—|to)\s*((?:[A-Z][a-z]{2,8}\.?\s*)?\d{4}|\d{1,2}[\/.]\d{4}|present|current)/i;
  draft.experience = splitSectionEntries(sections.experience).slice(0, 12).map((entry) => {
    const dates = entry.find((line) => dateRange.test(line))?.match(dateRange);
    const headline = entry.find((line) => !dateRange.test(line)) ?? '';
    const [position, company] = headline.split(/\s+(?:at|\||[-–—])\s+/i).map((value) => value.trim());
    return { company: company || '', position: position || headline, startDate: dates?.[1] ?? '', endDate: dates?.[2] ?? '', description: '', descriptionBullets: linesToBullets(entry.filter((line) => line !== headline && !dateRange.test(line))) };
  }).filter((item) => item.position || item.company || item.descriptionBullets.length);
  draft.projects = splitSectionEntries(sections.projects).slice(0, 12).map((entry) => {
    const [name = '', ...details] = entry;
    const link = entry.find((line) => /(?:https?:\/\/|www\.)/i.test(line)) ?? '';
    const technologies = entry.find((line) => /^(?:tech(?:nologies)?|stack|tools?)\s*:/i.test(line))?.replace(/^[^:]+:\s*/, '') ?? '';
    return { name, description: '', descriptionBullets: linesToBullets(details.filter((line) => line !== link && !/^(?:tech(?:nologies)?|stack|tools?)\s*:/i.test(line))), completionDate: entry.find((line) => /\b(?:19|20)\d{2}\b/.test(line))?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? '', technologies, link };
  }).filter((item) => item.name || item.descriptionBullets.length);
  draft.education = splitSectionEntries(sections.education).slice(0, 10).map((entry) => {
    const dates = entry.find((line) => dateRange.test(line))?.match(dateRange);
    const [institution = '', degree = '', ...details] = entry.filter((line) => !dateRange.test(line));
    return { institution, degree, field: '', startDate: dates?.[1] ?? '', endDate: dates?.[2] ?? '', description: details.join(' ').slice(0, 800) };
  }).filter((item) => item.institution || item.degree);
  draft.certificates = splitSectionEntries(sections.certificates).slice(0, 20).map((entry) => {
    const [name = '', issuer = '', ...details] = entry;
    const link = entry.find((line) => /(?:https?:\/\/|www\.)/i.test(line)) ?? '';
    return { name, issuer: issuer === link ? '' : issuer, date: entry.find((line) => /\b(?:19|20)\d{2}\b/.test(line))?.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? details.join(' ').match(/\b(?:19|20)\d{2}\b/)?.[0] ?? '', link };
  }).filter((item) => item.name);
  draft.warnings.push('Quick extraction is ready. AI cleanup is still running; review all dates and names before applying.');
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
function mergeDrafts(fallback: ResumeImportDraft, refined: ResumeImportDraft): ResumeImportDraft {
  return {
    personalInfo: { ...fallback.personalInfo, ...Object.fromEntries(Object.entries(refined.personalInfo).filter(([, value]) => Boolean(value))) },
    experience: refined.experience.length >= fallback.experience.length ? refined.experience : fallback.experience,
    projects: refined.projects.length >= fallback.projects.length ? refined.projects : fallback.projects,
    education: refined.education.length >= fallback.education.length ? refined.education : fallback.education,
    skills: refined.skills.length >= fallback.skills.length ? refined.skills : fallback.skills,
    languages: refined.languages.length >= fallback.languages.length ? refined.languages : fallback.languages,
    certificates: refined.certificates.length >= fallback.certificates.length ? refined.certificates : fallback.certificates,
    warnings: refined.warnings.length ? refined.warnings : fallback.warnings,
  };
}
async function refineDraftWithAi(extractedText: string) {
  const response = await fetch(`${process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434'}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(210_000),
    body: JSON.stringify({ model: process.env.OLLAMA_RESUME_MODEL ?? 'qwen2.5:3b', stream: false, format: 'json', options: { temperature: 0, num_predict: 900 }, messages: [
      { role: 'system', content: 'Extract factual résumé data. Return one compact JSON object only with exactly personalInfo, experience, projects, education, skills, languages, certificates, warnings. Never invent facts. personalInfo fields: fullName, email, phone, location, linkedin, website, summary. Experience: company, position, startDate, endDate, descriptionBullets. Projects: name, completionDate, technologies, link, descriptionBullets. Education: institution, degree, field, startDate, endDate, description. Certificates: name, issuer, date, link. Keep each descriptionBullets array to at most 3 factual bullets. Omit uncertain details.' },
      { role: 'user', content: compactTextForAi(extractedText) },
    ] }),
  });
  if (!response.ok) throw new Error('The local résumé model is unavailable.');
  const result = await response.json() as { message?: { content?: string } };
  return sanitizeDraft(JSON.parse(result.message?.content ?? '{}'));
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
          ? extractEmbeddedProfilePhoto(sourcePath, workspace).then((photo) => { logStage('photo extraction'); return photo; }).catch(() => { logStage('photo extraction unavailable'); return ''; })
          : Promise.resolve('');
        const extractedText = (await extractDocument(sourcePath, file.type, workspace, (message) => emit({ type: 'progress', message }))).trim();
        logStage('text extraction');
        if (extractedText.length < 30) throw new Error('No readable résumé text was found in this file.');
        emit({ type: 'progress', message: 'Building a quick preview from the extracted text…' });
        let draft = inferDraftFromText(extractedText); logStage('deterministic draft'); emit({ type: 'draft', draft, source: 'extracted' });
        emit({ type: 'progress', message: 'Your preview is ready. Improving detected sections with local AI…' });
        const aiDraftPromise = refineDraftWithAi(extractedText); const photoDataUrl = await photoPromise;
        if (photoDataUrl) { draft = { ...draft, photoDataUrl }; emit({ type: 'draft', draft, source: 'photo' }); }
        try { const aiDraft = await aiDraftPromise; logStage('AI normalization and sanitization'); emit({ type: 'draft', draft: { ...mergeDrafts(draft, aiDraft), photoDataUrl: photoDataUrl || undefined }, source: 'ai' }); emit({ type: 'complete', message: 'AI cleanup is complete. Review the detected details before applying them.' }); }
        catch (error) { const message = error instanceof Error ? error.message : 'AI cleanup could not finish.'; emit({ type: 'warning', message: `${message} The quick extraction remains available to review.` }); emit({ type: 'complete', message: 'Quick extraction is ready to review.' }); }
      } catch (error) { emit({ type: 'error', message: error instanceof Error ? error.message : 'Unable to import this résumé right now.' }); }
      finally { if (workspace) await rm(workspace, { recursive: true, force: true }); logStage('complete'); controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}