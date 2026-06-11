// /hooks/org/prescriptions/usePlanHistory.js
import { useCallback, useEffect, useState } from "react";
import { PAGE_SIZE } from "@/lib/org/prescriptions/prescriptions-constants";

export function usePlanHistory({
  selectedAthleteToken,
  orgAuthHeaders,
  setError,
  historyResetNonce,
}) {
  const [historyRequested, setHistoryRequested] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(null);
  // Which athlete token the current historyItems were fetched for.
  // Guards against showing stale data from a previous athlete during the reset window.
  const [fetchedForToken, setFetchedForToken] = useState("");

  // reset when athlete changes (via nonce)
  useEffect(() => {
    setHistoryRequested(false);
    setHistoryItems([]);
    setHistoryHasMore(false);
    setHistoryOffset(null);
    setFetchedForToken("");
  }, [historyResetNonce]);

  const searchHistory = useCallback(
    async ({ reset = true } = {}) => {
      const token = String(selectedAthleteToken || "").trim();
      if (!token) {
        setError("Selected athlete is missing AthleteToken.");
        return;
      }

      setHistoryRequested(true);
      setHistoryLoading(true);
      setError("");

      try {
        const offset = reset ? null : historyOffset;

        const url =
          `/api/org/nutrition/plans/getByAthlete?athleteToken=${encodeURIComponent(token)}` +
          `&pageSize=${PAGE_SIZE}` +
          (offset ? `&offset=${encodeURIComponent(offset)}` : "");

        const res = await fetch(url, {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...orgAuthHeaders },
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || data?.detail || "Failed to load plans.");

        const plans = Array.isArray(data?.plans) ? data.plans : [];
        const mapped = plans.map((p) => ({
          id: p.id,
          title: p.phase ? `Nutrition Plan • ${p.phase}` : "Nutrition Plan",
          prescription: p.prescription || "",
          createdAt: p.createdAt || "",
          createdBy: p.createdBy || "",
          _raw: p,
        }));

        if (reset) setHistoryItems(mapped);
        else setHistoryItems((prev) => prev.concat(mapped));
        setFetchedForToken(token);

        const nextOffset = data?.nextOffset ? String(data.nextOffset) : null;
        const hasMore = Boolean(data?.hasMore) || Boolean(nextOffset);

        setHistoryOffset(nextOffset);
        setHistoryHasMore(hasMore);
      } catch (err) {
        console.error("[org/prescriptions] searchHistory error:", err);
        if (reset) { setHistoryItems([]); setFetchedForToken(""); }
        setHistoryHasMore(false);
        setHistoryOffset(null);
        setError(err?.message || "Failed to load plans.");
      } finally {
        setHistoryLoading(false);
      }
    },
    [selectedAthleteToken, historyOffset, orgAuthHeaders, setError]
  );

  const loadMoreHistory = useCallback(() => {
    if (!historyHasMore || historyLoading) return;
    return searchHistory({ reset: false });
  }, [historyHasMore, historyLoading, searchHistory]);

  return {
    historyRequested,
    historyItems,
    historyLoading,
    historyHasMore,
    fetchedForToken,
    searchHistory,
    loadMoreHistory,

    // useful if plan create wants to force refresh
    setHistoryOffset,
  };
}
