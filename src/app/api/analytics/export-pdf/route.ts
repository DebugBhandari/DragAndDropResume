import { Pool } from "pg";

export const runtime = "nodejs";

const DATABASE_URL = process.env.EXPORT_ANALYTICS_DATABASE_URL;

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL })
  : null;

type ExportStats = {
  totalExports: number;
  lastExportAt: string | null;
  lastExportedEmail: string | null;
  exportsByEmail: Record<string, number>;
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email) return null;
  return email.length > 320 ? email.slice(0, 320) : email;
}

async function ensureTable() {
  if (!pool) {
    throw new Error(
      "Missing EXPORT_ANALYTICS_DATABASE_URL environment variable."
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resume_export_pdf_events (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NULL,
      method TEXT NULL,
      layout TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_resume_export_pdf_events_created_at
    ON resume_export_pdf_events (created_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_resume_export_pdf_events_email
    ON resume_export_pdf_events (email)
  `);
}

async function readStats(): Promise<ExportStats> {
  if (!pool) {
    throw new Error(
      "Missing EXPORT_ANALYTICS_DATABASE_URL environment variable."
    );
  }

  const totalResult = await pool.query<{
    total_exports: string;
    last_export_at: string | null;
    last_exported_email: string | null;
  }>(`
    SELECT
      COUNT(*)::text AS total_exports,
      MAX(created_at)::text AS last_export_at,
      (
        SELECT email
        FROM resume_export_pdf_events
        WHERE email IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 1
      ) AS last_exported_email
    FROM resume_export_pdf_events
  `);

  const byEmailResult = await pool.query<{ email: string; count: string }>(`
    SELECT email, COUNT(*)::text AS count
    FROM resume_export_pdf_events
    WHERE email IS NOT NULL
    GROUP BY email
    ORDER BY COUNT(*) DESC, email ASC
  `);

  const totals = totalResult.rows[0];
  const exportsByEmail: Record<string, number> = {};

  for (const row of byEmailResult.rows) {
    exportsByEmail[row.email] = Number(row.count) || 0;
  }

  return {
    totalExports: Number(totals?.total_exports || "0") || 0,
    lastExportAt: totals?.last_export_at ?? null,
    lastExportedEmail: totals?.last_exported_email ?? null,
    exportsByEmail,
  };
}

export async function GET() {
  try {
    await ensureTable();
    const stats = await readStats();
    return Response.json({ ok: true, stats });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to read export stats.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable();

    const body = (await request.json()) as {
      email?: unknown;
      method?: unknown;
      layout?: unknown;
    };

    const email = normalizeEmail(body.email);
    const method = typeof body.method === "string" ? body.method : null;
    const layout = typeof body.layout === "string" ? body.layout : null;

    if (!pool) {
      throw new Error(
        "Missing EXPORT_ANALYTICS_DATABASE_URL environment variable."
      );
    }

    await pool.query(
      `
        INSERT INTO resume_export_pdf_events (email, method, layout)
        VALUES ($1, $2, $3)
      `,
      [email, method, layout]
    );

    const stats = await readStats();

    return Response.json({ ok: true, stats });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record export event.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
