// lib/analytics.js
import { getConsent } from "@/lib/consent";

/* ─────────────────────────────────────────────────────────────────────────────
   ANON ID
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
───────────────────────────────────────────────────────────────────────────── */
function getIsReturnVisitor() {
  try {
    return !!localStorage.getItem("cp_anon_id");
  } catch {
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   USER EMAIL FALLBACK
   usePageView fires PAGE_VIEW before auth hydrates from localStorage.
   Reading directly here ensures logged-in email is always captured.
───────────────────────────────────────────────────────────────────────────── */
function getStoredUserEmail() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    const email = parsed?.Email || parsed?.email || "";
    return String(email).trim().toLowerCase();
  } catch {
    return "";
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   GEOLOCATION
   Stored in localStorage by CookieBanner when user accepts analytics.
   Returns { lat, lng, accuracy } or {} if unavailable/denied.
───────────────────────────────────────────────────────────────────────────── */
function getStoredGeo() {
  try {
    const raw = localStorage.getItem("cp_geo");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed?.denied) return {};
    return parsed || {};
  } catch {
    return {};
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   DEVICE TYPE
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
───────────────────────────────────────────────────────────────────────────── */
function getPageLoadMs() {
  try {
    const nav = performance?.getEntriesByType?.("navigation")?.[0];
    if (nav?.domContentLoadedEventEnd) return Math.round(nav.domContentLoadedEventEnd);
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
    geo:         getStoredGeo(), // { lat, lng, accuracy } or {}
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   EST TIMESTAMP
───────────────────────────────────────────────────────────────────────────── */
function getEstTimestamp() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const p = {};
  formatter.formatToParts(now).forEach(({ type, value }) => { p[type] = value; });
  return {
    timestampEst: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} EST`,
    timestampUtc: now.toISOString(),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE ENTRY TIME
───────────────────────────────────────────────────────────────────────────── */
const _pageEnteredAt = typeof window !== "undefined" ? Date.now() : 0;

function getTimeOnPageSeconds() {
  if (!_pageEnteredAt) return null;
  return Math.round((Date.now() - _pageEnteredAt) / 1000);
}

/* ─────────────────────────────────────────────────────────────────────────────
   PREVIOUS PATH
───────────────────────────────────────────────────────────────────────────── */
let _previousPath = "";
if (typeof window !== "undefined") {
  try { _previousPath = sessionStorage.getItem("cp_prev_path") || ""; } catch {}
}

export function recordCurrentPath() {
  if (typeof window === "undefined") return;
  try { sessionStorage.setItem("cp_prev_path", window.location.pathname); } catch {}
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCROLL DEPTH
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
  update();
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

    const isReturnVisitor                = getIsReturnVisitor();
    const anonId                         = getOrCreateAnonId(consentAnalytics);
    const sessionId                      = getOrCreateSessionId();
    const entryPage                      = getOrSetEntryPage();
    const client                         = getClientContext();
    const { timestampEst, timestampUtc } = getEstTimestamp();

    // Email priority: passed-in prop → localStorage user object → empty
    const userEmail =
      data.userEmail ||
      getStoredUserEmail() ||
      "";

    await fetch("/api/track-event", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        eventType:       data.eventType       || data.event_type || "",
        userEmail,
        path:            data.path            || (typeof window !== "undefined" ? window.location.pathname : ""),
        pageTitle:       data.pageTitle       || (typeof window !== "undefined" ? document.title : ""),
        previousPath:    data.previousPath    || _previousPath,
        entryPage,
        source:          data.source          || "",
        scrollDepth:     data.scrollDepth     ?? getScrollDepth(),
        timeOnPageSec:   data.timeOnPageSec   ?? getTimeOnPageSeconds(),
        isReturnVisitor: data.isReturnVisitor ?? isReturnVisitor,
        payload:         data.payload         || {},
        anonId,
        sessionId,
        consent:         { analytics: consentAnalytics },
        client,
        timestampEst,
        timestampUtc,
      }),
      keepalive: true,
    });
  } catch (err) {
    if (typeof window !== "undefined") console.warn("trackEvent failed:", err);
  }
}