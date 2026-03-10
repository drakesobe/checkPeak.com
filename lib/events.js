// lib/events.js
// Single source of truth for all analytics event names and types.
// Import these constants everywhere instead of using raw strings —
// prevents typos from creating phantom events in your Airtable.
//
// Usage:
//   import { EVENTS } from "@/lib/events";
//   trackEvent(EVENTS.PAGE_VIEW, { source: "homepage" });

export const EVENTS = {

  /* ── Page ──────────────────────────────────────────────────────────── */
  PAGE_VIEW:              "page_view",
  PAGE_EXIT:              "page_exit",           // fired on beforeunload

  /* ── Marketing funnel ──────────────────────────────────────────────── */
  CTA_CLICK:              "cta_click",           // any primary CTA button
  PRICING_VIEW:           "pricing_view",        // pricing section scrolled into view
  DEMO_REQUEST:           "demo_request",        // contact / demo form submitted
  SCAN_LINK_CLICK:        "scan_link_click",     // supplement scan link clicked
  SECTION_VIEWED:         "section_viewed",      // a major homepage section entered viewport

  /* ── Auth ──────────────────────────────────────────────────────────── */
  SIGNUP_STARTED:         "signup_started",
  SIGNUP_COMPLETED:       "signup_completed",
  LOGIN:                  "login",
  LOGOUT:                 "logout",
  INVITE_LINK_OPENED:     "invite_link_opened",  // /setup/trainer page loaded with token
  INVITE_COMPLETED:       "invite_completed",    // finishSetup succeeded

  /* ── Org tools ─────────────────────────────────────────────────────── */
  CHECKIN_SUBMITTED:      "checkin_submitted",
  NUTRITION_LOGGED:       "nutrition_logged",
  SUPPLEMENT_SCANNED:     "supplement_scanned",
  REVIEW_QUEUE_OPENED:    "review_queue_opened",
  MEMBER_INVITED:         "member_invited",
  MEMBER_EDITED:          "member_edited",
  MEMBER_REMOVED:         "member_removed",

  /* ── Engagement ────────────────────────────────────────────────────── */
  VIDEO_PLAYED:           "video_played",
  SCROLL_MILESTONE:       "scroll_milestone",    // 25 / 50 / 75 / 100
  TIME_MILESTONE:         "time_milestone",      // 30s / 60s / 120s on page

  /* ── Errors ────────────────────────────────────────────────────────── */
  API_ERROR:              "api_error",
  FORM_VALIDATION_FAILED: "form_validation_failed",
};

/* ── Event type categories ────────────────────────────────────────────────
   Used for the "Event Type" field — lets you filter by broad category
   in Airtable views without touching individual event names.
─────────────────────────────────────────────────────────────────────────── */
export const EVENT_TYPES = {
  PAGE:        "page",
  FUNNEL:      "funnel",
  AUTH:        "auth",
  ORG:         "org",
  ENGAGEMENT:  "engagement",
  ERROR:       "error",
};

/* ── Event → type mapping ─────────────────────────────────────────────────
   Used by useTrack to auto-populate eventType from the event name.
─────────────────────────────────────────────────────────────────────────── */
export const EVENT_TYPE_MAP = {
  [EVENTS.PAGE_VIEW]:              EVENT_TYPES.PAGE,
  [EVENTS.PAGE_EXIT]:              EVENT_TYPES.PAGE,
  [EVENTS.CTA_CLICK]:              EVENT_TYPES.FUNNEL,
  [EVENTS.PRICING_VIEW]:           EVENT_TYPES.FUNNEL,
  [EVENTS.DEMO_REQUEST]:           EVENT_TYPES.FUNNEL,
  [EVENTS.SCAN_LINK_CLICK]:        EVENT_TYPES.FUNNEL,
  [EVENTS.SECTION_VIEWED]:         EVENT_TYPES.FUNNEL,
  [EVENTS.SIGNUP_STARTED]:         EVENT_TYPES.AUTH,
  [EVENTS.SIGNUP_COMPLETED]:       EVENT_TYPES.AUTH,
  [EVENTS.LOGIN]:                  EVENT_TYPES.AUTH,
  [EVENTS.LOGOUT]:                 EVENT_TYPES.AUTH,
  [EVENTS.INVITE_LINK_OPENED]:     EVENT_TYPES.AUTH,
  [EVENTS.INVITE_COMPLETED]:       EVENT_TYPES.AUTH,
  [EVENTS.CHECKIN_SUBMITTED]:      EVENT_TYPES.ORG,
  [EVENTS.NUTRITION_LOGGED]:       EVENT_TYPES.ORG,
  [EVENTS.SUPPLEMENT_SCANNED]:     EVENT_TYPES.ORG,
  [EVENTS.REVIEW_QUEUE_OPENED]:    EVENT_TYPES.ORG,
  [EVENTS.MEMBER_INVITED]:         EVENT_TYPES.ORG,
  [EVENTS.MEMBER_EDITED]:          EVENT_TYPES.ORG,
  [EVENTS.MEMBER_REMOVED]:         EVENT_TYPES.ORG,
  [EVENTS.VIDEO_PLAYED]:           EVENT_TYPES.ENGAGEMENT,
  [EVENTS.SCROLL_MILESTONE]:       EVENT_TYPES.ENGAGEMENT,
  [EVENTS.TIME_MILESTONE]:         EVENT_TYPES.ENGAGEMENT,
  [EVENTS.API_ERROR]:              EVENT_TYPES.ERROR,
  [EVENTS.FORM_VALIDATION_FAILED]: EVENT_TYPES.ERROR,
};