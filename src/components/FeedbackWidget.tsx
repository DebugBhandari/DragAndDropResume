"use client";

import { useMemo, useState } from "react";
import { useResumeStore } from "@/store/useResumeStore";
import { getUiText } from "@/utils/uiTranslations";

type FeedbackFormState = {
  name: string;
  email: string;
  message: string;
};

const INITIAL_FORM: FeedbackFormState = {
  name: "",
  email: "",
  message: "",
};

export default function FeedbackWidget() {
  const { activeLocale } = useResumeStore();
  const ui = getUiText(activeLocale);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [form, setForm] = useState<FeedbackFormState>(INITIAL_FORM);

  const isValid = useMemo(() => {
    const email = form.email.trim();
    const hasName = form.name.trim().length > 1;
    const hasMessage = form.message.trim().length > 5;
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return hasName && hasMessage && emailLooksValid;
  }, [form]);

  const closeModal = () => {
    setIsOpen(false);
    setStatus("idle");
    setStatusMessage("");
  };

  const updateField = (field: keyof FeedbackFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (status !== "idle") {
      setStatus("idle");
      setStatusMessage("");
    }
  };

  const submitFeedback = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    setStatus("idle");
    setStatusMessage("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          message: form.message.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message || ui.feedbackError);
      }

      setStatus("success");
      setStatusMessage(ui.feedbackSuccess);
      setForm(INITIAL_FORM);
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : ui.feedbackError,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-90 rounded-full bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
        aria-label={ui.openFeedbackAria}
      >
        {ui.feedbackButton}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-100 flex items-end justify-center bg-slate-900/45 p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl">
            <div className="bg-linear-to-r from-sky-50 via-cyan-50 to-blue-50 px-5 py-4 sm:px-6">
              <div className="mb-1 inline-flex rounded-full border border-sky-200 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sky-700">
                {ui.feedbackContact}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{ui.feedbackSendTitle}</h2>
                  <p className="text-sm text-slate-600">
                    {ui.feedbackSubtitle}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  aria-label={ui.closeFeedbackAria}
                >
                  x
                </button>
              </div>

              <form onSubmit={submitFeedback} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    className="input-field"
                    placeholder={ui.feedbackName}
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    required
                  />

                  <input
                    className="input-field"
                    type="email"
                    placeholder={ui.feedbackEmail}
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    required
                  />
                </div>

                <textarea
                  className="input-field min-h-32"
                  placeholder={ui.feedbackMessage}
                  value={form.message}
                  onChange={(e) => updateField("message", e.target.value)}
                  required
                />

                {status !== "idle" && (
                  <p
                    className={`text-sm ${status === "success" ? "text-emerald-700" : "text-red-600"}`}
                  >
                    {statusMessage}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {ui.feedbackCancel}
                  </button>
                  <button
                    type="submit"
                    disabled={!isValid || isSubmitting}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                  >
                    {isSubmitting ? ui.feedbackSending : ui.feedbackSend}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
