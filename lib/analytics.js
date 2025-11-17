// lib/analytics.js
export async function trackEvent(eventName, data = {}) {
  try {
    await fetch("/api/track-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        eventType: data.eventType || data.event_type || data.eventType,
        userEmail: data.userEmail || "",
        path: data.path || "",
        source: data.source || "",
        device: data.device || "",
        payload: data.payload || {},
      }),
    });
  } catch (err) {
    // Fail silently on client; log only in dev
    if (typeof window !== "undefined") {
      console.warn("trackEvent failed:", err);
    }
  }
}
