import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

export const runtime = 'nodejs';
export const maxDuration = 150;

const execFileAsync = promisify(execFile);
const MAX_BYTES = 10 * 1024 * 1024;
const DOCLING_BIN = process.env.DOCLING_BIN ?? 'docling';
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g;

const WORD_SUFFIXES = [
  'ations?', 'itions?', 'tions?', 'ments?', 'ences?', 'ances?', 'ities?', 'ingly', 'edly',
  'ation', 'ition', 'ment', 'ence', 'ance', 'ity', 'able', 'ible', 'ally', 'ingly',
  'ized', 'ised', 'izer', 'iser', 'ing', 'ers?', 'est', 'ed', 'ly', 'al', 'ive', 'ous', 'ful', 'less',
].join('|');

function repairSplitWords(value: string) {
  return value
    // Typical PDF glyph-positioning artifact: "e x p e r i e n c e" → "experience".
    // Restrict this to lower-case runs so normal prose such as "I a m" is not altered.
    .replace(/(?<!\S)(?:[a-z]\s+){2,}[a-z](?!\S)/g, (match) => match.replace(/\s+/g, ''))
    // Repair a word broken immediately before a common suffix, for example
    // "experi ence", "develop ment", or "collabor ation". The suffix list keeps
    // this intentionally narrower than merging arbitrary neighbouring words.
    .replace(new RegExp(`\\b([A-Za-z]{2,})\\s+(${WORD_SUFFIXES})\\b`, 'gi'), '$1$2')
    .replace(/\s+([,.;:!?%])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1');
}

function normalizeDoclingMarkdown(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    // A hyphen at the end of a PDF-wrapped line is generally a split word.
    .replace(/([A-Za-z])-[ \t]*\n[ \t]*([a-z])/g, '$1$2')
    .replace(/\n{3,}/g, '\n\n')
    .split(/\n\n+/)
    .map((paragraph) => repairSplitWords(paragraph.replace(/[ \t]*\n[ \t]*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim()))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function normalizeLine(value: string) {
  return repairSplitWords(value.replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/[ \t]+/g, ' ').trim());
}

function isLikelyName(value: string) {
  const candidate = value.replace(/^(?:name|signed|from)\s*[:|-]\s*/i, '').trim();
  return /^[A-Z][a-zÀ-ÿ'’-]{1,}(?:\s+[A-Z][a-zÀ-ÿ'’-]{1,}){1,3}$/.test(candidate);
}

function extractPhone(value: string) {
  for (const match of value.matchAll(PHONE_PATTERN)) {
    const candidate = match[0].replace(/\s+/g, ' ').trim();
    if (candidate.replace(/\D/g, '').length >= 7) return candidate;
  }
  return '';
}

function extractImportedFields(markdown: string) {
  const lines = markdown
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean);
  const fullText = lines.join('\n');
  const emails = fullText.match(new RegExp(EMAIL_PATTERN.source, 'gi')) ?? [];
  const email = emails.at(-1) ?? '';
  const phone = extractPhone([...lines].reverse().join('\n'));
  const contactIndexes = lines.map((line, index) => EMAIL_PATTERN.test(line) || Boolean(extractPhone(line)) ? index : -1).filter((index) => index >= 0);
  const contactIndex = contactIndexes.at(-1) ?? -1;
  const footerWindow = contactIndex >= 0 ? lines.slice(Math.max(0, contactIndex - 3), Math.min(lines.length, contactIndex + 4)) : lines.slice(-6);
  const nameFromContactLine = footerWindow
    .flatMap((line) => line.split(/[|•·▪◦]/).map((part) => part.trim()))
    .find(isLikelyName) ?? '';
  const senderName = nameFromContactLine || [...lines].reverse().find(isLikelyName) || '';
  const senderLocation = footerWindow.find((line) => {
    const candidate = line.replace(EMAIL_PATTERN, '').replace(PHONE_PATTERN, '').replace(/[|•·▪◦]/g, ' ').trim();
    return candidate.length >= 4 && candidate.length <= 100 && /[A-Za-zÀ-ÿ]/.test(candidate) && /,|\b(?:city|state|province|country|remote|hybrid)\b/i.test(candidate) && !isLikelyName(candidate);
  }) ?? '';
  return { senderName, senderEmail: email, senderPhone: phone, senderLocation };
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ message: 'Upload a PDF file.' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.type !== 'application/pdf' || file.size === 0 || file.size > MAX_BYTES) {
    return Response.json({ message: 'Upload a PDF no larger than 10 MB.' }, { status: 400 });
  }

  let workspace = '';
  try {
    workspace = await mkdtemp(join(tmpdir(), 'cover-letter-import-'));
    const sourcePath = join(workspace, 'source.pdf');
    const outputDirectory = join(workspace, 'docling');
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(sourcePath, Buffer.from(await file.arrayBuffer()));
    await execFileAsync(DOCLING_BIN, ['convert', '--from', 'pdf', '--to', 'md', '--output', outputDirectory, '--pipeline', 'native', '--no-ocr', sourcePath], {
      timeout: 120_000,
      maxBuffer: 2_000_000,
    });
    const markdownFiles = (await readdir(outputDirectory)).filter((name) => name.endsWith('.md')).sort();
    if (!markdownFiles[0]) throw new Error('Docling did not produce readable Markdown for this PDF.');
    const markdown = await readFile(join(outputDirectory, markdownFiles[0]), 'utf8');
    const text = normalizeDoclingMarkdown(markdown);
    if (text.length < 20) throw new Error('Docling could not find readable cover-letter content in this PDF.');
    return Response.json({ text, fields: extractImportedFields(markdown) });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Docling could not import this PDF.';
    return Response.json({ message: `Docling PDF extraction failed. ${detail}` }, { status: 422 });
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true });
  }
}