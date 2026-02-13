"use client";

export default function NutritionControls({ search, setSearch, filterMode, setFilterMode }) {
  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]/30";

  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
      <input
        className={inputBase}
        placeholder="Search name, email, token, or reason…"
        value={search}
        onChange={(e) => setSearch?.(e.target.value)}
      />

      <select
        className="px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm"
        value={filterMode}
        onChange={(e) => setFilterMode?.(e.target.value)}
      >
        <option value="action">Needs Action</option>
        <option value="missing_checkin">Missing Check-in</option>
        <option value="low_adherence">Low Adherence</option>
        <option value="no_plan">No Plan</option>
        <option value="all">All</option>
      </select>
    </div>
  );
}
