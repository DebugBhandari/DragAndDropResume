import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), ".data");
const STATS_FILE = path.join(DATA_DIR, "export-stats.json");

type ExportStats = {
  totalExports: number;
  lastExportAt: string | null;
  lastExportedEmail: string | null;
  exportsByEmail: Record<string, number>;
};

const INITIAL_STATS: ExportStats = {
  totalExports: 0,
  lastExportAt: null,
  lastExportedEmail: null,
  exportsByEmail: {},
};

async function loadStats(): Promise<ExportStats> {
  try {
    const raw = await readFile(STATS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<ExportStats>;

    return {
      totalExports: Number.isFinite(parsed.totalExports)
        ? Number(parsed.totalExports)
        : 0,
      lastExportAt:
        typeof parsed.lastExportAt === "string" ? parsed.lastExportAt : null,
      lastExportedEmail:
        typeof parsed.lastExportedEmail === "string"
          ? parsed.lastExportedEmail
          : null,
      exportsByEmail:
        parsed.exportsByEmail && typeof parsed.exportsByEmail === "object"
          ? parsed.exportsByEmail
          : {},
    };
  } catch {
    return INITIAL_STATS;
  }
}

async function saveStats(stats: ExportStats) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STATS_FILE, JSON.stringify(stats, null, 2), "utf8");
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email) return null;
  return email.length > 320 ? email.slice(0, 320) : email;
}

export async function GET() {
  const stats = await loadStats();
  return Response.json({ ok: true, stats });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: unknown;
      method?: unknown;
      layout?: unknown;
    };

    const email = normalizeEmail(body.email);
    const stats = await loadStats();
    const updated: ExportStats = {
      ...stats,
      totalExports: stats.totalExports + 1,
      lastExportAt: new Date().toISOString(),
      lastExportedEmail: email,
      exportsByEmail: { ...stats.exportsByEmail },
    };

    if (email) {
      updated.exportsByEmail[email] = (updated.exportsByEmail[email] || 0) + 1;
    }

    await saveStats(updated);

    return Response.json({ ok: true, stats: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record export event.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
