// lib/analytics.js
import { getConsent } from "@/lib/consent";

function getOrCreateAnonId(consentAnalytics) {
  // Only persist an ID if analytics is consented.
  // If no consent, return empty (or a per-page ephemeral id if you want).
  if (!consentAnalytics) return "";

  const key = "cp_anon_id";
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).toString();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "";
  }
}

function getClientContext() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);

  // Only include common attribution params (keep payload small)
  const utm = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => {
    const v = params.get(k);
    if (v) utm[k] = v;
  });

  return {
    referrer: document.referrer || "",
    language: navigator.language || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    viewport: { w: window.innerWidth || null, h: window.innerHeight || null },
    screen: { w: window.screen?.width || null, h: window.screen?.height || null },
    utm,
  };
}

export async function trackEvent(eventName, data = {}) {
  try {
    const consent = getConsent();
    const consentAnalytics = !!consent.analytics;

    // If user declined analytics, you can either:
    // A) do nothing (recommended), or
    // B) send only truly essential security telemetry.
    // Here we choose: don't send analytics events without consent.
    if (!consentAnalytics) return;

    const anonId = getOrCreateAnonId(consentAnalytics);
    const client = getClientContext();

    await fetch("/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        eventType: data.eventType || data.event_type || "",
        userEmail: data.userEmail || "",
        path: data.path || (typeof window !== "undefined" ? window.location.pathname : ""),
        source: data.source || "",
        payload: data.payload || {},
        anonId,
        consent: { analytics: consentAnalytics },
        client,
      }),
      keepalive: true,
    });
  } catch (err) {
    if (typeof window !== "undefined") console.warn("trackEvent failed:", err);
  }
}
