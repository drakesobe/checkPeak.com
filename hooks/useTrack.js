// hooks/useTrack.js
// One-line access to trackEvent from any component.
// Auto-populates eventType from the EVENT_TYPE_MAP so callers don't have
// to think about it.
//
// Usage:
//   const track = useTrack();
//   track(EVENTS.CTA_CLICK, { source: "hero", payload: { label: "Start free trial" } });

import { useCallback } from "react";
import { trackEvent } from "@/lib/analytics";
import { EVENT_TYPE_MAP } from "@/lib/events";

export function useTrack() {
  return useCallback((eventName, data = {}) => {
    const eventType = data.eventType || EVENT_TYPE_MAP[eventName] || "";
    trackEvent(eventName, { ...data, eventType });
  }, []);
}