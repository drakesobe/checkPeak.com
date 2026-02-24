// hooks/org/athletes/useAthletesShortcuts.js
"use client";

import { useEffect } from "react";
import { clamp } from "@/lib/org/athletes/utils";

/**
 * Keeps your keyboard behavior exactly:
 * / focuses search
 * n = next-up
 * Esc closes drawer
 * j/k = navigation
 * x = select
 * o = open prescriptions
 * d = done (auto-advance only in drawer mode if you pass it that way)
 * s = star
 */
export function useAthletesShortcuts({
  enabled,
  drawerOpen,
  drawerAthlete,
  filtered,
  paged,
  activeRowId,
  searchRef,
  closeDrawer,
  openDrawer,
  setActiveRowId,
  toggleSelect,
  openPrescriptions,
  toggleDoneAndMaybeAdvance,
  toggleStarred,
  athletesMap,
  goNextUp,
}) {
  useEffect(() => {
    if (!enabled) return;

    const isTypingTarget = () => {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName?.toLowerCase?.();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (el.getAttribute && el.getAttribute("contenteditable") === "true") return true;
      return false;
    };

    const onKeyDown = (e) => {
      if (!enabled) return;

      if (e.key === "/" && !isTypingTarget()) {
        e.preventDefault();
        searchRef?.current?.focus?.();
        return;
      }

      if (e.key === "n" && !isTypingTarget()) {
        e.preventDefault();
        goNextUp?.();
        return;
      }

      if (e.key === "Escape") {
        if (drawerOpen) closeDrawer?.();
        return;
      }

      if (isTypingTarget()) return;

      const currentId = drawerOpen ? drawerAthlete?.id : activeRowId || "";
      const list = drawerOpen ? filtered : paged;
      const idx = currentId ? list.findIndex((a) => a.id === currentId) : -1;

      if (e.key === "j") {
        const next = list[clamp((idx >= 0 ? idx : -1) + 1, 0, list.length - 1)];
        if (next) (drawerOpen ? openDrawer?.(next.id) : setActiveRowId?.(next.id));
      }

      if (e.key === "k") {
        const prev = list[clamp((idx >= 0 ? idx : 0) - 1, 0, list.length - 1)];
        if (prev) (drawerOpen ? openDrawer?.(prev.id) : setActiveRowId?.(prev.id));
      }

      if (e.key === "x" && currentId) toggleSelect?.(currentId);

      if (e.key === "o") {
        const a = athletesMap?.get?.(currentId);
        if (a?.email) openPrescriptions?.(a.email);
      }

      if (e.key === "d" && currentId) toggleDoneAndMaybeAdvance?.(currentId, drawerOpen);

      if (e.key === "s" && currentId) toggleStarred?.(currentId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    enabled,
    drawerOpen,
    drawerAthlete,
    filtered,
    paged,
    activeRowId,
    searchRef,
    closeDrawer,
    openDrawer,
    setActiveRowId,
    toggleSelect,
    openPrescriptions,
    toggleDoneAndMaybeAdvance,
    toggleStarred,
    athletesMap,
    goNextUp,
  ]);
}