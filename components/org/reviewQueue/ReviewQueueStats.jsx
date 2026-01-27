// components/org/reviewQueue/ReviewQueueStats.jsx
"use client";

export default function ReviewQueueStats({ counts }) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
        <p className="text-xs text-gray-500">Pending</p>
        <p className="text-2xl font-extrabold text-gray-900 mt-1">{counts.pending}</p>
      </div>
      <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
        <p className="text-xs text-gray-500">Needs Info</p>
        <p className="text-2xl font-extrabold text-gray-900 mt-1">{counts.needsInfo}</p>
      </div>
      <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
        <p className="text-xs text-gray-500">Approved</p>
        <p className="text-2xl font-extrabold text-gray-900 mt-1">{counts.approved}</p>
      </div>
    </div>
  );
}
