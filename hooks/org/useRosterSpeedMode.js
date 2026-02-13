// hooks/org/useRosterSpeedMode.js
"use client";

import { useCallback, useRef, useState } from "react";
import {
  getEmailFromAthlete,
  getAthleteToken,
  normalizeEmail,
} from "@/lib/org/prescriptions/prescriptions-utils";

export function useRosterSpeedMode({
  filteredAthletes,
  selectedAthleteEmail,
  setSelectedAthleteEmail,
  router,
}) {
  const [completedEmails, setCompletedEmails] = useState(() => new Set());
  const advancingRef = useRef(false);

  const goToNextAthlete = useCallback(() => {
    const list = Array.isArray(filteredAthletes) ? filteredAthletes : [];
    if (!list.length) return;

    const current = normalizeEmail(selectedAthleteEmail);
    const currentIdx = list.findIndex((a) => getEmailFromAthlete(a) === current);

    // If current not in filtered list, jump to first valid
    if (currentIdx < 0) {
      const first = list.find((a) => getEmailFromAthlete(a));
      if (!first) return;

      const firstEmail = getEmailFromAthlete(first);
      const firstToken = getAthleteToken(first);

      if (firstEmail) setSelectedAthleteEmail(firstEmail);

      router.push(
        firstToken
          ? `/org/prescriptions?athleteToken=${encodeURIComponent(firstToken)}`
          : `/org/prescriptions?athleteEmail=${encodeURIComponent(firstEmail)}`,
        undefined,
        { shallow: true }
      );
      return;
    }

    // Find next athlete with an email
    let nextIdx = currentIdx + 1;
    if (nextIdx >= list.length) nextIdx = 0;

    let safety = 0;
    while (safety < list.length && !getEmailFromAthlete(list[nextIdx])) {
      nextIdx = (nextIdx + 1) % list.length;
      safety++;
    }

    const next = list[nextIdx];
    if (!next) return;

    const nextEmail = getEmailFromAthlete(next);
    const nextToken = getAthleteToken(next);

    if (!nextEmail) return;

    setSelectedAthleteEmail(nextEmail);

    router.push(
      nextToken
        ? `/org/prescriptions?athleteToken=${encodeURIComponent(nextToken)}`
        : `/org/prescriptions?athleteEmail=${encodeURIComponent(nextEmail)}`,
      undefined,
      { shallow: true }
    );
  }, [filteredAthletes, selectedAthleteEmail, setSelectedAthleteEmail, router]);

  const markDone = useCallback((email) => {
    const e = normalizeEmail(email);
    if (!e) return;
    setCompletedEmails((prev) => {
      const next = new Set(prev);
      next.add(e);
      return next;
    });
  }, []);

  const advanceSafely = useCallback((fn, delay = 150) => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setTimeout(() => {
      try {
        fn?.();
      } finally {
        advancingRef.current = false;
      }
    }, delay);
  }, []);

  return { completedEmails, markDone, goToNextAthlete, advanceSafely };
}
