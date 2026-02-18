// components/org/reviewQueue/ReviewQueueTable.jsx
"use client";

import { Fragment, useMemo, useState, useCallback } from "react";

import TableHeader from "@/components/org/reviewQueue/table/TableHeader";
import EmptyState from "@/components/org/reviewQueue/table/EmptyState";
import RowMain from "@/components/org/reviewQueue/table/RowMain";
import RowExpanded from "@/components/org/reviewQueue/table/RowExpanded";
import MobileList from "@/components/org/reviewQueue/table/MobileList";
import TableBottomBar from "@/components/org/reviewQueue/table/TableBottomBar";

import { buildRowVM, fallbackNormalizeText, normLower } from "@/components/org/reviewQueue/table/helpers";

export default function ReviewQueueTable({
  items,
  expanded,
  toggleExpanded,
  openModal,
  fmtDate,
  normalizeText,
}) {
  const norm = normalizeText || fallbackNormalizeText;

  const [onlyUnresolved, setOnlyUnresolved] = useState(false);

  const list = useMemo(() => {
    const src = Array.isArray(items) ? items : [];
    if (!onlyUnresolved) return src;
    return src.filter((it) => normLower(it?.reviewStatus) !== "approved");
  }, [items, onlyUnresolved]);

  const onToggle = useCallback(
    (id) => {
      if (!id) return;
      toggleExpanded?.(id);
    },
    [toggleExpanded]
  );

  const onReview = useCallback(
    (it) => {
      openModal?.(it);
    },
    [openModal]
  );

  return (
    <div className="mt-5">
      {/* MOBILE: card list */}
      <div className="md:hidden">
        <MobileList
          items={list}
          expanded={expanded}
          toggleExpanded={onToggle}
          onReview={onReview}
          norm={norm}
          fmtDate={fmtDate}
        />
      </div>

      {/* DESKTOP: table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full text-sm">
          <TableHeader />
          <tbody>
            {list.length === 0 ? (
              <EmptyState />
            ) : (
              list.map((it) => {
                const vm = buildRowVM(it, norm, fmtDate);
                const isExpanded = Boolean(expanded?.[vm.id]);

                return (
                  <Fragment key={vm.id || vm.title}>
                    <RowMain
                      vm={vm}
                      isExpanded={isExpanded}
                      onToggle={() => onToggle(vm.id)}
                      onReview={() => onReview(vm.raw)}
                    />
                    {isExpanded ? <RowExpanded vm={vm} /> : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ Bottom/status bar */}
      <div className="md:hidden">
        <TableBottomBar
          count={list.length}
          onlyUnresolved={onlyUnresolved}
          setOnlyUnresolved={setOnlyUnresolved}
          showCount={false}   // mobile doesn't need "Showing X" if it feels redundant
          showTip={false}     // mobile list already teaches the pattern
        />
      </div>

      <div className="hidden md:block">
        <TableBottomBar
          count={list.length}
          onlyUnresolved={onlyUnresolved}
          setOnlyUnresolved={setOnlyUnresolved}
          showCount={true}
          showTip={true}
        />
      </div>
    </div>
  );
}
