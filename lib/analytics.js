// lib/analytics.js
import { getConsent } from "@/lib/consent";

/* ─────────────────────────────────────────────────────────────────────────────
   ANON ID
   Persisted in localStorage. Only created if analytics consent is given.
───────────────────────────────────────────────────────────────────────────── */
function getOrCreateAnonId(consentAnalytics) {
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

/* ─────────────────────────────────────────────────────────────────────────────
   SESSION ID
   Persisted in sessionStorage so it resets on new tab/window.
   Groups all events within a single visit together.
───────────────────────────────────────────────────────────────────────────── */
function getOrCreateSessionId() {
  const key = "cp_session_id";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).toString();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "";
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ENTRY PAGE
   First page of the session — stored once per sessionStorage lifetime.
───────────────────────────────────────────────────────────────────────────── */
function getOrSetEntryPage() {
  const key = "cp_entry_page";
  try {
    let entry = sessionStorage.getItem(key);
    if (!entry) {
      entry = typeof window !== "undefined" ? window.location.pathname : "";
      if (entry) sessionStorage.setItem(key, entry);
    }
    return entry || "";
  } catch {
    return "";
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   RETURN VISITOR
   If anonId already existed in localStorage before this session,
   this is a return visitor.
───────────────────────────────────────────────────────────────────────────── */
function getIsReturnVisitor() {
  try {
    return !!localStorage.getItem("cp_anon_id");
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   DEVICE TYPE
   Derived from viewport width — no UA sniffing needed.
───────────────────────────────────────────────────────────────────────────── */
function getDeviceType() {
  if (typeof window === "undefined") return "";
  const w = window.innerWidth;
  if (w <= 768) return "mobile";
  if (w <= 1024) return "tablet";
  return "desktop";
}

/* ─────────────────────────────────────────────────────────────────────────────
   CONNECTION TYPE
   Navigator connection API — widely available on mobile Chrome/Android.
   Not available on Safari/Firefox but degrades gracefully.
───────────────────────────────────────────────────────────────────────────── */
function getConnection() {
  try {
    const conn = navigator?.connection || navigator?.mozConnection || navigator?.webkitConnection;
    if (!conn) return "";
    return conn.effectiveType || conn.type || "";
  } catch {
    return "";
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE PERFORMANCE
   Time from navigation start to DOMContentLoaded in ms.
   Only meaningful if called after page load.
───────────────────────────────────────────────────────────────────────────── */
function getPageLoadMs() {
  try {
    const nav = performance?.getEntriesByType?.("navigation")?.[0];
    if (nav?.domContentLoadedEventEnd) {
      return Math.round(nav.domContentLoadedEventEnd);
    }
    // Fallback: performance.timing (deprecated but still works)
    const t = performance?.timing;
    if (t?.domContentLoadedEventEnd && t?.navigationStart) {
      return Math.round(t.domContentLoadedEventEnd - t.navigationStart);
    }
    return null;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   UTM + REFERRER
───────────────────────────────────────────────────────────────────────────── */
function getUtm() {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => {
    const v = params.get(k);
    if (v) utm[k] = v;
  });
  return utm;
}

/* ─────────────────────────────────────────────────────────────────────────────
   FULL CLIENT CONTEXT
   Everything we can ethically collect in one object.
───────────────────────────────────────────────────────────────────────────── */
function getClientContext() {
  if (typeof window === "undefined") return {};
  return {
    referrer:    document.referrer || "",
    language:    navigator.language || "",
    timezone:    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    viewport:    { w: window.innerWidth || null, h: window.innerHeight || null },
    screen:      { w: window.screen?.width || null, h: window.screen?.height || null },
    deviceType:  getDeviceType(),
    connection:  getConnection(),
    pageLoadMs:  getPageLoadMs(),
    utm:         getUtm(),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE ENTRY TIME
   Module-level timestamp so time-on-page is calculated from when the
   module was first imported (i.e. when the page loaded), not when the
   event fires.
───────────────────────────────────────────────────────────────────────────── */
const _pageEnteredAt = typeof window !== "undefined" ? Date.now() : 0;

function getTimeOnPageSeconds() {
  if (!_pageEnteredAt) return null;
  return Math.round((Date.now() - _pageEnteredAt) / 1000);
}

/* ─────────────────────────────────────────────────────────────────────────────
   PREVIOUS PATH
   Stored at module init so we always have the path that preceded the
   current one, even after client-side navigation.
───────────────────────────────────────────────────────────────────────────── */
let _previousPath = "";
if (typeof window !== "undefined") {
  try {
    _previousPath = sessionStorage.getItem("cp_prev_path") || "";
  } catch {}
}

export function recordCurrentPath() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("cp_prev_path", window.location.pathname);
  } catch {}
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCROLL DEPTH
   Returns the furthest scroll percentage reached (0–100).
   Call startScrollTracking() once per page to enable.
───────────────────────────────────────────────────────────────────────────── */
let _maxScrollDepth = 0;
let _scrollListenerAttached = false;

export function startScrollTracking() {
  if (typeof window === "undefined" || _scrollListenerAttached) return;
  _scrollListenerAttached = true;
  _maxScrollDepth = 0;

  const update = () => {
    const scrolled = window.scrollY + window.innerHeight;
    const total    = document.documentElement.scrollHeight || 1;
    const pct      = Math.round((scrolled / total) * 100);
    if (pct > _maxScrollDepth) _maxScrollDepth = Math.min(pct, 100);
  };

  window.addEventListener("scroll", update, { passive: true });
  update(); // capture initial position
}

export function stopScrollTracking() {
  _scrollListenerAttached = false;
  _maxScrollDepth = 0;
}

function getScrollDepth() {
  return _maxScrollDepth || 0;
}

/* ─────────────────────────────────────────────────────────────────────────────
   CORE TRACK EVENT
───────────────────────────────────────────────────────────────────────────── */
export async function trackEvent(eventName, data = {}) {
  try {
    const consent          = getConsent();
    const consentAnalytics = !!consent.analytics;
    if (!consentAnalytics) return;

    // Check return visitor BEFORE creating the anon ID so the flag is accurate
    const isReturnVisitor = getIsReturnVisitor();
    const anonId          = getOrCreateAnonId(consentAnalytics);
    const sessionId        = getOrCreateSessionId();
    const entryPage        = getOrSetEntryPage();
    const client           = getClientContext();

    await fetch("/api/track-event", {
      method:    "POST",
      headers:   { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        eventType:       data.eventType        || data.event_type  || "",
        userEmail:       data.userEmail        || "",
        path:            data.path             || (typeof window !== "undefined" ? window.location.pathname : ""),
        pageTitle:       data.pageTitle        || (typeof window !== "undefined" ? document.title : ""),
        previousPath:    data.previousPath     || _previousPath,
        entryPage,
        source:          data.source           || "",
        scrollDepth:     data.scrollDepth      ?? getScrollDepth(),
        timeOnPageSec:   data.timeOnPageSec    ?? getTimeOnPageSeconds(),
        isReturnVisitor: data.isReturnVisitor  ?? isReturnVisitor,
        payload:         data.payload          || {},
        anonId,
        sessionId,
        consent:         { analytics: consentAnalytics },
        client,
      }),
      keepalive: true,
    });
  } catch (err) {
    if (typeof window !== "undefined") console.warn("trackEvent failed:", err);
  }
}