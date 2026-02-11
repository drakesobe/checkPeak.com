// components/org/trainers/TeamTableCard.js
"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import TrainersTable from "@/components/org/trainers/TrainersTable";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function TeamTableCard({
  title = "Team",
  subtitle = "",
  hint = "",
  rows = [],              // ✅ default so rows.length is safe
  loading = false,
  canManage = false,
  onEditSave,
  onRemoveClick,
}) {
  const [search, setSearch] = useState("");

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  const filtered = useMemo(() => {
    const list = Array.isArray(rows) ? rows : [];
    const q = String(search || "").trim().toLowerCase();
    if (!q) return list;

    return list.filter((t) => {
      const hay = [
        t?.Name,
        t?.Email,
        t?.Role,
        t?.Active ? "active" : "inactive",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [rows, search]);

  return (
    <section className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold">{title}</h2>
          {subtitle ? <p className="text-sm text-gray-600 mt-1">{subtitle}</p> : null}
          {hint ? <p className="text-[11px] text-gray-500 mt-1">{hint}</p> : null}
        </div>

        <div className="w-full sm:w-[460px] space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className={classNames(inputBase, "pl-10")}
              placeholder="Search by name, email, role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <TrainersTable
          trainers={filtered}          // ✅ TrainersTable receives trainers
          loading={loading}
          canManage={canManage}
          onEditSave={onEditSave}
          onRemoveClick={onRemoveClick}
        />
      </div>
    </section>
  );
}
