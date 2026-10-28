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
        className="feedback-trigger studio-secondary-button inline-flex h-10 items-center justify-center px-3 text-sm font-semibold"
        aria-label={ui.openFeedbackAria}
      >
        {ui.feedbackButton}
      </button>

      {isOpen && (
        <div className="feedback-overlay fixed inset-0 z-100 flex items-end justify-center p-3 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="feedback-modal w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl">
            <div className="feedback-modal-header px-5 py-4 sm:px-6">
              <div className="feedback-modal-badge mb-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                {ui.feedbackContact}
              </div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="feedback-modal-title text-xl font-bold">{ui.feedbackSendTitle}</h2>
                  <p className="feedback-modal-subtitle text-sm">
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
                  className="feedback-close rounded-lg px-2 py-1 transition"
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
                    className={`text-sm ${status === "success" ? "feedback-status-success" : "feedback-status-error"}`}
                  >
                    {statusMessage}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="feedback-cancel rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    {ui.feedbackCancel}
                  </button>
                  <button
                    type="submit"
                    disabled={!isValid || isSubmitting}
                    className="feedback-submit rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed"
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
