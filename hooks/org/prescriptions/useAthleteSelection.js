// /hooks/org/prescriptions/useAthleteSelection.js
import { useEffect, useMemo, useState } from "react";
import { getAthleteToken, normalizeEmail } from "@/lib/org/prescriptions/prescriptions-utils";

export function useAthleteSelection({ router, athletes }) {
  const [athleteSearch, setAthleteSearch] = useState("");
  const [selectedAthleteEmail, setSelectedAthleteEmail] = useState("");

  // history reset helper you can reuse anywhere
  const [historyResetNonce, setHistoryResetNonce] = useState(0);
  const resetHistoryState = () => setHistoryResetNonce((n) => n + 1);

  // Preselect from URL
  useEffect(() => {
    const qEmail = router?.query?.athleteEmail;
    const qToken = router?.query?.athleteToken;

    resetHistoryState();

    if (typeof qEmail === "string" && qEmail.includes("@")) {
      setSelectedAthleteEmail(normalizeEmail(qEmail));
      return;
    }

    if (typeof qToken === "string" && qToken.startsWith("ATH-")) {
      const token = qToken.trim();
      const match = (athletes || []).find((a) => getAthleteToken(a) === token);
      if (match?.email) setSelectedAthleteEmail(normalizeEmail(match.email));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router?.query?.athleteEmail, router?.query?.athleteToken, athletes]);

  const selectedAthlete = useMemo(() => {
    const email = normalizeEmail(selectedAthleteEmail);
    return (athletes || []).find((a) => normalizeEmail(a?.email) === email) || null;
  }, [athletes, selectedAthleteEmail]);

  const selectedAthleteToken = useMemo(() => getAthleteToken(selectedAthlete), [selectedAthlete]);

  const filteredAthletes = useMemo(() => {
    const q = String(athleteSearch || "").trim().toLowerCase();
    if (!q) return athletes || [];
    return (athletes || []).filter((a) => {
      const name = String(a?.name || "").toLowerCase();
      const email = String(a?.email || "").toLowerCase();
      const token = String(getAthleteToken(a) || "").toLowerCase();
      return name.includes(q) || email.includes(q) || token.includes(q);
    });
  }, [athletes, athleteSearch]);

  return {
    athleteSearch,
    setAthleteSearch,
    selectedAthleteEmail,
    setSelectedAthleteEmail,
    selectedAthlete,
    selectedAthleteToken,
    filteredAthletes,
    historyResetNonce,
    resetHistoryState,
  };
}
