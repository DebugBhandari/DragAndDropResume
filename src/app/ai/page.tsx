"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type AiStatus = {
  ok: boolean;
  model: string;
  installed: boolean;
  error?: string;
  lastImport?: {
    startedAt: string;
    completedAt?: string;
    status: "running" | "complete" | "failed";
    fileType: string;
    fileSizeBytes: number;
    timingsMs: Record<"uploadWrite" | "pdfTextExtraction" | "pdfRasterization" | "tesseract" | "deterministicDraft" | "ollama" | "photoExtraction" | "total", number>;
    error?: string;
  } | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`The server returned HTTP ${response.status} instead of JSON. ${body.replace(/\s+/g, " ").slice(0, 180)}`);
  }
}

function formatDuration(milliseconds: number) {
  if (milliseconds < 1_000) return `${milliseconds} ms`;
  return `${(milliseconds / 1_000).toFixed(milliseconds >= 10_000 ? 1 : 2)} s`;
}

export default function AiPage() {
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const checkStatus = useCallback(async () => {
    setChecking(true);
    setError("");
    try {
      const response = await fetch("/api/ai/status", { cache: "no-store" });
      const result = await readJson<AiStatus>(response);
      setStatus(result);
      if (!response.ok) setError(result.error || `Status check failed with HTTP ${response.status}.`);
    } catch (reason) {
      setStatus(null);
      setError(reason instanceof Error ? reason.message : "Unable to check Ollama status.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = prompt.trim();
    if (!message || sending) return;

    setMessages((current) => [...current, { role: "user", content: message }]);
    setPrompt("");
    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const result = await readJson<{ reply?: string; message?: string }>(response);
      if (!response.ok || !result.reply) throw new Error(result.message || `Chat failed with HTTP ${response.status}.`);
      setMessages((current) => [...current, { role: "assistant", content: result.reply! }]);
      void checkStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to contact local Ollama.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="ai-diagnostic min-h-dvh p-4 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="ai-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="ai-kicker">Private server diagnostic</p>
            <h1 className="text-2xl font-bold">Local AI / Ollama</h1>
            <p className="mt-1 text-sm opacity-75">This page sends requests only through this app to the VPS-local model. Ollama remains unexposed to the public internet.</p>
          </div>
          <Link href="/" className="ai-secondary-button">Back to résumé builder</Link>
        </header>

        <section className="ai-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Model status</h2>
              {checking ? <p className="mt-1 text-sm opacity-75">Checking local Ollama…</p> : status ? (
                <p className="mt-1 text-sm opacity-75">Configured model: <strong>{status.model}</strong></p>
              ) : <p className="mt-1 text-sm opacity-75">No status response.</p>}
            </div>
            <button type="button" className="ai-secondary-button" onClick={() => void checkStatus()} disabled={checking}>
              {checking ? "Checking…" : "Refresh status"}
            </button>
          </div>
          {status && !checking && (
            <p className={`ai-status mt-4 ${status.ok && status.installed ? "ai-status-ok" : "ai-status-error"}`}>
              {status.ok && status.installed ? "Ollama is reachable and the configured model is installed." : status.ok ? "Ollama is reachable, but the configured model is not installed." : status.error || "Ollama is unavailable."}
            </p>
          )}
        </section>

        <section className="ai-card p-5">
          <h2 className="font-semibold">Last résumé import timing</h2>
          <p className="mt-1 text-sm opacity-75">Server-side timings for the most recent import. These diagnostics store no résumé content or personal details.</p>
          {!status?.lastImport ? <p className="mt-4 text-sm opacity-60">No import timing has been recorded since this server started.</p> : (
            <>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm opacity-75">
                <span>Status: <strong>{status.lastImport.status}</strong></span>
                <span>Started: <strong>{new Date(status.lastImport.startedAt).toLocaleString()}</strong></span>
                <span>File: <strong>{status.lastImport.fileType} · {(status.lastImport.fileSizeBytes / 1024).toFixed(1)} KB</strong></span>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {[
                  ["Upload/write", status.lastImport.timingsMs.uploadWrite],
                  ["PDF text extraction", status.lastImport.timingsMs.pdfTextExtraction],
                  ["PDF rasterization", status.lastImport.timingsMs.pdfRasterization],
                  ["Tesseract OCR", status.lastImport.timingsMs.tesseract],
                  ["Quick preview parsing", status.lastImport.timingsMs.deterministicDraft],
                  ["Ollama", status.lastImport.timingsMs.ollama],
                  ["Profile photo extraction", status.lastImport.timingsMs.photoExtraction],
                  ["Total", status.lastImport.timingsMs.total],
                ].map(([label, duration]) => (
                  <div key={label} className="flex items-center justify-between rounded-lg border border-[var(--form-border)] px-3 py-2">
                    <dt>{label}</dt><dd className="font-semibold">{formatDuration(duration as number)}</dd>
                  </div>
                ))}
              </dl>
              {status.lastImport.timingsMs.tesseract === 0 && <p className="mt-3 text-xs opacity-60">Tesseract was not used for this import; the file had directly extractable text.</p>}
              {status.lastImport.error && <p className="ai-status ai-status-error mt-4">Last import error: {status.lastImport.error}</p>}
            </>
          )}
        </section>

        <section className="ai-card p-5">
          <h2 className="font-semibold">Test chat</h2>
          <p className="mt-1 text-sm opacity-75">Use a short message, such as “Reply with exactly: Ollama is working”.</p>
          <div className="ai-chat-log mt-4 space-y-3" aria-live="polite">
            {messages.length === 0 ? <p className="text-sm opacity-60">No messages yet.</p> : messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`ai-message ai-message-${message.role}`}>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide">{message.role === "user" ? "You" : "Ollama"}</p>
                <p className="whitespace-pre-wrap text-sm">{message.content}</p>
              </article>
            ))}
          </div>
          <form className="mt-4 space-y-3" onSubmit={sendMessage}>
            <textarea className="input-field min-h-28" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={4000} placeholder="Ask the local model a diagnostic question…" disabled={sending} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs opacity-60">{prompt.length.toLocaleString()} / 4,000</span>
              <button type="submit" className="ai-primary-button" disabled={sending || !prompt.trim()}>{sending ? "Waiting for Ollama…" : "Send to local model"}</button>
            </div>
          </form>
          {error && <p className="ai-status ai-status-error mt-4">{error}</p>}
        </section>
      </div>
    </main>
  );
}