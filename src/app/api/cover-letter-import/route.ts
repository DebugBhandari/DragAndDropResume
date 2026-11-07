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
const encoder = new TextEncoder();
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g;
const GREETING_PATTERN = /^(?:dear|hello|hi|to whom it may concern)\b/i;
const CLOSING_PATTERN = /^(?:sincerely|kind regards|best regards|warm regards|regards|best|thank you|yours truly|respectfully)[,!.]?$/i;

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
  const paragraphBoundary = '\u0000';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    // A hyphen at the end of a PDF-wrapped line is generally a split word.
    .replace(/([A-Za-z])-[ \t]*\n[ \t]*([a-z])/g, '$1$2')
    // Preserve a paragraph only when a sentence terminator is followed by a
    // substantial whitespace gap. All other Docling PDF wraps are prose wraps.
    .replace(/([.!?])\s{2,}/g, `$1${paragraphBoundary}`)
    .replace(/\s+/g, ' ')
    .split(paragraphBoundary)
    .map((paragraph) => repairSplitWords(paragraph.trim()))
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function extractCoverLetterImport(markdown: string) {
  const text = normalizeDoclingMarkdown(markdown);
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const fields = extractImportedFields(markdown);
  const greetingIndex = paragraphs.findIndex((paragraph) => GREETING_PATTERN.test(paragraph));
  const closingIndex = greetingIndex >= 0
    ? paragraphs.findIndex((paragraph, index) => index > greetingIndex && CLOSING_PATTERN.test(paragraph))
    : -1;
  const start = greetingIndex >= 0 ? greetingIndex + 1 : 0;
  const end = closingIndex >= 0 ? closingIndex : paragraphs.length;
  const body = paragraphs.slice(start, end).join('\n\n') || text;

  return {
    senderName: fields.senderName,
    senderEmail: fields.senderEmail,
    senderPhone: fields.senderPhone,
    senderLocation: fields.senderLocation,
    body,
  };
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

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let workspace = '';
      try {
        emit({ type: 'stage', stage: 'upload', detail: 'Saving the PDF in the server processing workspace…' });
        workspace = await mkdtemp(join(tmpdir(), 'cover-letter-import-'));
        const sourcePath = join(workspace, 'source.pdf'); const outputDirectory = join(workspace, 'docling');
        await mkdir(outputDirectory, { recursive: true }); await writeFile(sourcePath, Buffer.from(await file.arrayBuffer()));
        emit({ type: 'stage', stage: 'docling', detail: 'Docling is extracting embedded text from the PDF…' });
        // Use Docling's local-only pipeline. The standard pipeline downloads layout/OCR
        // models on first use, which makes imports fail on servers without Hugging Face access.
        await execFileAsync(DOCLING_BIN, ['convert', '--from', 'pdf', '--to', 'md', '--output', outputDirectory, '--pipeline', 'native', '--no-ocr', sourcePath], { timeout: 120_000, maxBuffer: 2_000_000 });
        emit({ type: 'stage', stage: 'parsing', detail: 'Extracting sender contact details and the letter body…' });
        const markdownFiles = (await readdir(outputDirectory)).filter((name) => name.endsWith('.md')).sort();
        if (!markdownFiles[0]) throw new Error('Docling did not produce readable Markdown for this PDF.');
        const markdown = await readFile(join(outputDirectory, markdownFiles[0]), 'utf8'); const importedLetter = extractCoverLetterImport(markdown);
        if (importedLetter.body.length < 20) throw new Error('Docling could not find readable cover-letter content in this PDF.');
        emit({ type: 'result', text: importedLetter.body, fields: importedLetter });
        emit({ type: 'complete', message: 'Docling import is ready and has replaced the current cover-letter draft.' });
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Docling could not import this PDF.';
        emit({ type: 'error', message: `Docling PDF extraction failed. ${detail}` });
      } finally { if (workspace) await rm(workspace, { recursive: true, force: true }); controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}