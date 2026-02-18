// components/org/reviewQueue/table/TableHeader.jsx
"use client";

export default function TableHeader() {
  return (
    <thead>
      <tr className="text-left text-xs text-gray-500 border-b">
        <th className="py-3 pr-4">Item</th>
        <th className="py-3 pr-4">Athlete</th>
        <th className="py-3 pr-4">Date</th>
        <th className="py-3 pr-4">Uploads</th>
        <th className="py-3 pr-4">Daily</th>
        <th className="py-3 pr-4">Review</th>
        <th className="py-3 pr-4">Created</th>
        <th className="py-3 pr-2 text-right">Actions</th>
      </tr>
    </thead>
  );
}
