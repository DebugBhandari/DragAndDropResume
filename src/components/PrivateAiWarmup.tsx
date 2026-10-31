"use client";

import { useEffect } from "react";

export default function PrivateAiWarmup() {
  useEffect(() => {
    void fetch("/api/ai/warmup", {
      method: "POST",
      cache: "no-store",
      keepalive: true,
    }).catch(() => {
      // Import remains available even if a best-effort warm-up cannot finish.
    });
  }, []);

  return null;
}