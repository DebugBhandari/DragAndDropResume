import { readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type LastImportTiming = {
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'complete' | 'failed';
  fileType: string;
  fileSizeBytes: number;
  timingsMs: {
    uploadWrite: number;
    pdfTextExtraction: number;
    pdfRasterization: number;
    tesseract: number;
    deterministicDraft: number;
    ollama: number;
    photoExtraction: number;
    total: number;
  };
  error?: string;
};

const timingPath = join(tmpdir(), 'drag-and-drop-resume-last-import-timing.json');

export async function readLastImportTiming(): Promise<LastImportTiming | null> {
  try {
    return JSON.parse(await readFile(timingPath, 'utf8')) as LastImportTiming;
  } catch {
    return null;
  }
}

export async function writeLastImportTiming(timing: LastImportTiming) {
  try {
    const temporaryPath = `${timingPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(timing), 'utf8');
    await rename(temporaryPath, timingPath);
  } catch {
    // Timing diagnostics must never interrupt a résumé import.
  }
}