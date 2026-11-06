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

function normalizeDoclingMarkdown(value: string) {
  return value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
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
    const text = normalizeDoclingMarkdown(await readFile(join(outputDirectory, markdownFiles[0]), 'utf8'));
    if (text.length < 20) throw new Error('Docling could not find readable cover-letter content in this PDF.');
    return Response.json({ text });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Docling could not import this PDF.';
    return Response.json({ message: `Docling PDF extraction failed. ${detail}` }, { status: 422 });
  } finally {
    if (workspace) await rm(workspace, { recursive: true, force: true });
  }
}