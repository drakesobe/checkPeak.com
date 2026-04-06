// hooks/athlete-today/useDayPlannerClasses.js
// Manages the athlete's recurring class schedule.
// Classes are stored in localStorage keyed by athleteToken (or "anon" for guests).
// Each class repeats on specific days of the week.
"use client";

import { useState, useEffect, useCallback } from "react";

const LS_KEY_PREFIX = "checkpeak:classes";

function lsGet(key) {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function lsSet(key, val) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/**
 * @param {string} athleteToken  — used to namespace the storage key per athlete
 * @returns {{
 *   classes: Array,
 *   addClass: (cls: {name, time, room, days}) => void,
 *   deleteClass: (id: string) => void,
 *   classesForDow: (dow: number) => Array,
 * }}
 */
export function useDayPlannerClasses({ athleteToken = "anon" } = {}) {
  const storageKey = `${LS_KEY_PREFIX}:${athleteToken}`;

  const [classes, setClasses] = useState(() => lsGet(storageKey) || []);

  // Persist on every change
  useEffect(() => {
    lsSet(storageKey, classes);
  }, [classes, storageKey]);

  const addClass = useCallback((cls) => {
    setClasses(prev => [
      ...prev,
      {
        ...cls,
        id:        `cls-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      },
    ]);
  }, []);

  const deleteClass = useCallback((id) => {
    setClasses(prev => prev.filter(c => c.id !== id));
  }, []);

  /**
   * Returns only the classes that repeat on a given day of week (0=Sun … 6=Sat).
   */
  const classesForDow = useCallback((dow) => {
    return classes.filter(c => Array.isArray(c.days) && c.days.includes(dow));
  }, [classes]);

  return { classes, addClass, deleteClass, classesForDow };
}