// hooks/athlete-today/useDayPlannerOrder.js
// Persists the athlete's custom block order for each date.
// Falls back to the default raw-block order when no saved order exists.
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const LS_KEY_PREFIX = "checkpeak:day-order";

function lsGet(key) {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function lsSet(key, val) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

/**
 * @param {{ dateISO: string, rawBlocks: Array }} options
 * @returns {{
 *   orderedBlocks: Array,
 *   setOrderedBlocks: Function,
 *   saveOrder: (blocks: Array) => void,
 * }}
 */
export function useDayPlannerOrder({ dateISO, rawBlocks }) {
  const orderKey      = `${LS_KEY_PREFIX}:${dateISO}`;
  const rawBlocksRef  = useRef(rawBlocks);

  // Keep ref current so the effect below doesn't stale-close over rawBlocks
  useEffect(() => { rawBlocksRef.current = rawBlocks; }, [rawBlocks]);

  const [orderedBlocks, setOrderedBlocks] = useState([]);

  // Whenever date or raw blocks change, re-apply the saved order
  useEffect(() => {
    const savedOrder = lsGet(orderKey);

    if (savedOrder && Array.isArray(savedOrder) && savedOrder.length > 0) {
      const blockMap = new Map(rawBlocks.map(b => [b.id, b]));
      const sorted   = [];

      // Place blocks in saved order first
      for (const id of savedOrder) {
        const b = blockMap.get(id);
        if (b) sorted.push(b);
      }
      // Append any new blocks not captured in saved order
      for (const b of rawBlocks) {
        if (!savedOrder.includes(b.id)) sorted.push(b);
      }

      setOrderedBlocks(sorted);
    } else {
      setOrderedBlocks(rawBlocks);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO, rawBlocks.map(b => b.id).join(",")]);

  const saveOrder = useCallback((blocks) => {
    lsSet(orderKey, blocks.map(b => b.id));
    setOrderedBlocks(blocks);
  }, [orderKey]);

  return { orderedBlocks, setOrderedBlocks, saveOrder };
}