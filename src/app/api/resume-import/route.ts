import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ResumeImportDraft } from '@/types/resume';

export const runtime = 'nodejs';
export const maxDuration = 240;

const execFileAsync = promisify(execFile);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 3;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function text(value: unknown, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function validLevel(value: string, levels: readonly string[], fallback: string) {
  return levels.includes(value) ? value : fallback;
}

function namedRows(value: unknown) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([name, detail]) =>
      detail && typeof detail === 'object' ? { name, ...(detail as Record<string, unknown>) } : { name, detail },
    );
  }
  return [];
}

function sanitizeDraft(value: unknown): ResumeImportDraft {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const personal = raw.personalInfo && typeof raw.personalInfo === 'object' ? raw.personalInfo as Record<string, unknown> : {};
  return {
    personalInfo: {
      fullName: text(personal.fullName ?? personal.name, 120), email: text(personal.email, 160), phone: text(personal.phone, 80),
      location: text(personal.location, 160), linkedin: text(personal.linkedin, 240), website: text(personal.website, 240), summary: text(personal.summary, 1200),
    },
    experience: array(raw.experience).slice(0, 12).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const bullets = array(row.descriptionBullets).map((bullet) => text(bullet, 360)).filter(Boolean).slice(0, 10);
      const description = text(row.description, 1200);
      return { company: text(row.company, 180), position: text(row.position, 180), startDate: text(row.startDate, 60), endDate: text(row.endDate, 60), description, descriptionBullets: bullets.length ? bullets : description ? [description] : [] };
    }).filter((item) => item.company || item.position),
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
    warnings: array(raw.warnings).map((warning) => text(warning, 240)).filter(Boolean).slice(0, 8),
  };
}

async function ocrImage(path: string) {
  const { stdout } = await execFileAsync('tesseract', [path, 'stdout', '--oem', '1', '--psm', '3', '-l', 'eng'], { timeout: 60_000, maxBuffer: 2_000_000 });
  return stdout;
}

async function extractDocument(path: string, type: string, workspace: string) {
  if (type !== 'application/pdf') return ocrImage(path);
  const { stdout } = await execFileAsync('pdftotext', ['-layout', path, '-'], { timeout: 30_000, maxBuffer: 2_000_000 });
  if (stdout.replace(/\s/g, '').length >= 100) return stdout;
  const prefix = join(workspace, 'page');
  await execFileAsync('pdftoppm', ['-png', '-r', '180', '-f', '1', '-l', String(MAX_PDF_PAGES), path, prefix], { timeout: 60_000 });
  const pages = await Promise.all(Array.from({ length: MAX_PDF_PAGES }, async (_, index) => {
    try { return await ocrImage(`${prefix}-${index + 1}.png`); } catch { return ''; }
  }));
  return pages.filter(Boolean).join('\n\n--- Page break ---\n\n');
}

export async function POST(request: Request) {
  let workspace = '';
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return Response.json({ message: 'Upload a PDF, PNG, or JPEG file.' }, { status: 400 });
    }
    const file = formData.get('file');
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size === 0 || file.size > MAX_BYTES) {
      return Response.json({ message: 'Upload a PDF, PNG, or JPEG no larger than 10 MB.' }, { status: 400 });
    }
    workspace = await mkdtemp(join(tmpdir(), 'resume-import-'));
    await mkdir(workspace, { recursive: true });
    const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
    const sourcePath = join(workspace, `source.${extension}`);
    await writeFile(sourcePath, Buffer.from(await file.arrayBuffer()));
    const extractedText = (await extractDocument(sourcePath, file.type, workspace)).trim().slice(0, 30_000);
    if (extractedText.length < 30) return Response.json({ message: 'No readable résumé text was found in this file.' }, { status: 422 });
    const response = await fetch(`${process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434'}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(210_000),
      body: JSON.stringify({ model: process.env.OLLAMA_RESUME_MODEL ?? 'qwen2.5:3b', stream: false, format: 'json', options: { temperature: 0 }, messages: [
        { role: 'system', content: 'Extract factual résumé data. Return one JSON object only. Use exactly these top-level keys: personalInfo, experience, education, skills, languages, warnings. personalInfo uses fullName, email, phone, location, linkedin, website, summary. skills and languages must be arrays of objects, never maps or strings. Never invent facts. Use empty strings or arrays for unknown values. Experience entries must have company, position, startDate, endDate, descriptionBullets. Education entries must have institution, degree, field, startDate, endDate, description. Skills use Expert, Advanced, Intermediate, or Beginner. Languages use Native, Fluent, Advanced, Intermediate, or Beginner.' },
        { role: 'user', content: extractedText },
      ] }),
    });
    if (!response.ok) throw new Error('The local résumé model is unavailable.');
    const result = await response.json() as { message?: { content?: string } };
    const draft = sanitizeDraft(JSON.parse(result.message?.content ?? '{}'));
    return Response.json({ draft });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to import this résumé right now.';
    return Response.json({ message }, { status: 500 });
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true });
  }
}