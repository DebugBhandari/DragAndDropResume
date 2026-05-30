"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ExportStats = {
  totalExports: number;
  lastExportAt: string | null;
  lastExportedEmail: string | null;
  exportsByEmail: Record<string, number>;
};

type ExportStatsResponse = {
  ok: boolean;
  stats?: ExportStats;
  error?: string;
};

function formatTimestamp(value: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export default function DeepakReportsPage() {
  const [stats, setStats] = useState<ExportStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      const response = await fetch("/api/analytics/export-pdf", {
        cache: "no-store",
      });
      const data = (await response.json()) as ExportStatsResponse;

      if (!response.ok || !data.ok || !data.stats) {
        throw new Error(data.error || "Failed to load reports.");
      }

      setStats(data.stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load reports.";
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();

    const interval = window.setInterval(() => {
      void loadReports(true);
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadReports]);

  const emailRows = useMemo(() => {
    if (!stats) return [];

    return Object.entries(stats.exportsByEmail)
      .sort((a, b) => b[1] - a[1])
      .map(([email, count]) => ({ email, count }));
  }, [stats]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Export Reports</h1>
              <p className="mt-1 text-sm text-slate-600">
                Live totals from /api/analytics/export-pdf
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadReports(true)}
              disabled={isLoading || isRefreshing}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total PDF Exports</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {isLoading ? "..." : stats?.totalExports ?? 0}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Last Export Time</p>
            <p className="mt-2 text-base font-medium text-slate-900 break-words">
              {isLoading ? "..." : formatTimestamp(stats?.lastExportAt ?? null)}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Last Export Email</p>
            <p className="mt-2 text-base font-medium text-slate-900 break-all">
              {isLoading ? "..." : stats?.lastExportedEmail || "-"}
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Exports By Email</h2>

          {isLoading ? (
            <p className="mt-3 text-sm text-slate-600">Loading reports...</p>
          ) : emailRows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No email export records yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Email</th>
                    <th className="px-2 py-2">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {emailRows.map((row) => (
                    <tr key={row.email} className="border-b border-slate-100 text-sm text-slate-800">
                      <td className="px-2 py-2 break-all">{row.email}</td>
                      <td className="px-2 py-2">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
