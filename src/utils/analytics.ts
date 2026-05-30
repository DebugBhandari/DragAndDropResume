export function trackAnalyticsEvent(
  eventName: string,
  params: Record<string, string | number | boolean> = {},
) {
  if (typeof window === "undefined") return;

  const gtag = (window as Window & {
    gtag?: (command: string, event: string, params?: Record<string, string | number | boolean>) => void;
  }).gtag;

  if (typeof gtag !== "function") return;
  gtag("event", eventName, params);
}
