// /hooks/org/usePlanTemplates.js
"use client";

import { useCallback, useRef, useState } from "react";
import { safeJson } from "@/lib/org/workouts-calendar-utils";

export function usePlanTemplates() {
  const [templates, setTemplates] = useState([]);
  const abortRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      abortRef.current?.abort?.();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`/api/org/getPlanTemplates`, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      });

      const data = await safeJson(res);
      if (!res.ok) return;

      setTemplates(Array.isArray(data?.templates) ? data.templates : []);
    } catch (err) {
      const name = String(err?.name || "").toLowerCase();
      if (name.includes("abort")) return;
    }
  }, []);

  const abort = useCallback(() => {
    try {
      abortRef.current?.abort?.();
    } catch {}
  }, []);

  return { templates, setTemplates, refresh, abort };
}
