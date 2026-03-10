// hooks/usePageView.js
// Drop this into _app.js or layout.js once and every page is tracked
// automatically, including:
//   - page_view on mount
//   - scroll milestones (25 / 50 / 75 / 100%)
//   - time milestones (30s / 60s / 120s)
//   - page_exit on unmount (fires with final scroll depth + time on page)
//   - previous path tracking for navigation flow analysis
//
// Usage in _app.js:
//   import { usePageView } from "@/hooks/usePageView";
//   function App({ Component, pageProps }) {
//     usePageView();
//     return <Component {...pageProps} />;
//   }

import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { trackEvent, startScrollTracking, stopScrollTracking, recordCurrentPath } from "@/lib/analytics";
import { EVENTS, EVENT_TYPES } from "@/lib/events";

const SCROLL_MILESTONES  = [25, 50, 75, 100];
const TIME_MILESTONES_MS = [30_000, 60_000, 120_000]; // 30s, 1min, 2min

export function usePageView({ userEmail = "" } = {}) {
  const router              = useRouter();
  const firedScrollRef      = useRef(new Set());
  const firedTimeRef        = useRef(new Set());
  const pageEnteredAtRef    = useRef(Date.now());
  const timeoutHandlesRef   = useRef([]);
  const scrollIntervalRef   = useRef(null);

  // Keep userEmail in a ref so it's always current inside the effect
  // without being a dependency. Auth hydrates from localStorage after
  // first render — if userEmail were a dep, the effect would re-run
  // (and re-fire page_view) every time the user object settles.
  const userEmailRef = useRef(userEmail);
  useEffect(() => { userEmailRef.current = userEmail; }, [userEmail]);

  useEffect(() => {
    const path  = router.asPath || window.location.pathname;
    const email = userEmailRef.current; // stable snapshot for this page

    // Reset milestone tracking on each navigation
    firedScrollRef.current   = new Set();
    firedTimeRef.current     = new Set();
    pageEnteredAtRef.current = Date.now();

    // Clear any leftover timers from the previous page
    timeoutHandlesRef.current.forEach(clearTimeout);
    timeoutHandlesRef.current = [];
    if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);

    // Start scroll tracking
    startScrollTracking();

    // ── Fire page_view ──────────────────────────────────────────────────
    trackEvent(EVENTS.PAGE_VIEW, {
      eventType: EVENT_TYPES.PAGE,
      path,
      pageTitle: document.title,
      userEmail: email,
    });

    // ── Scroll milestones ───────────────────────────────────────────────
    let lastDepth = 0;
    scrollIntervalRef.current = setInterval(() => {
      const scrolled = window.scrollY + window.innerHeight;
      const total    = document.documentElement.scrollHeight || 1;
      const depth    = Math.round((scrolled / total) * 100);

      if (depth === lastDepth) return;
      lastDepth = depth;

      for (const milestone of SCROLL_MILESTONES) {
        if (depth >= milestone && !firedScrollRef.current.has(milestone)) {
          firedScrollRef.current.add(milestone);
          trackEvent(EVENTS.SCROLL_MILESTONE, {
            eventType: EVENT_TYPES.ENGAGEMENT,
            path,
            userEmail: userEmailRef.current, // use ref so logged-in email is captured if it arrives mid-session
            payload:   { milestone, depth },
          });
        }
      }
    }, 500);

    // ── Time milestones ─────────────────────────────────────────────────
    for (const ms of TIME_MILESTONES_MS) {
      const handle = setTimeout(() => {
        if (!firedTimeRef.current.has(ms)) {
          firedTimeRef.current.add(ms);
          trackEvent(EVENTS.TIME_MILESTONE, {
            eventType: EVENT_TYPES.ENGAGEMENT,
            path,
            userEmail: userEmailRef.current,
            payload:   { seconds: Math.round(ms / 1000) },
          });
        }
      }, ms);
      timeoutHandlesRef.current.push(handle);
    }

    // ── Page exit ───────────────────────────────────────────────────────
    const handleExit = () => {
      const timeOnPageSec  = Math.round((Date.now() - pageEnteredAtRef.current) / 1000);
      const scrolled       = window.scrollY + window.innerHeight;
      const total          = document.documentElement.scrollHeight || 1;
      const finalScrollPct = Math.round((scrolled / total) * 100);

      trackEvent(EVENTS.PAGE_EXIT, {
        eventType: EVENT_TYPES.PAGE,
        path,
        userEmail: userEmailRef.current,
        timeOnPageSec,
        scrollDepth: finalScrollPct,
      });

      recordCurrentPath();
    };

    window.addEventListener("beforeunload", handleExit);

    return () => {
      clearInterval(scrollIntervalRef.current);
      timeoutHandlesRef.current.forEach(clearTimeout);
      timeoutHandlesRef.current = [];
      window.removeEventListener("beforeunload", handleExit);
      stopScrollTracking();
      recordCurrentPath();
    };
  }, [router.asPath]); // ← path change only — userEmail is read via ref
}