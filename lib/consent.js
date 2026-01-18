// lib/consent.js
const CONSENT_KEY = "cp_consent_v1";

export function getConsent() {
  if (typeof window === "undefined") return { analytics: false, decided: false };
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return { analytics: false, decided: false };
    const parsed = JSON.parse(raw);
    return {
      analytics: !!parsed.analytics,
      decided: true,
      updatedAt: parsed.updatedAt || null,
    };
  } catch {
    return { analytics: false, decided: false };
  }
}

export function setConsent(next) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({
      analytics: !!next.analytics,
      updatedAt: new Date().toISOString(),
    })
  );
}

export function clearConsent() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CONSENT_KEY);
}
