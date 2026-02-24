// hooks/org/athletes/useLocalStorageState.js
"use client";

import { useEffect, useState } from "react";
import { safeJsonParse } from "@/lib/org/athletes/utils";

export function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    const raw = window.localStorage.getItem(key);
    const parsed = safeJsonParse(raw || "", null);
    return parsed == null ? initialValue : parsed;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}