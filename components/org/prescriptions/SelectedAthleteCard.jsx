// components/org/prescriptions/SelectedAthleteCard.jsx
"use client";

import { normalizeEmail } from "@/lib/org/prescriptions/prescriptions-utils";

export default function SelectedAthleteCard({ selectedAthlete, selectedAthleteToken, view, setView }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold">Selected Athlete</h2>
          {selectedAthlete ? (
            <p className="text-sm text-gray-700 mt-1 truncate">
              <span className="font-semibold">{selectedAthlete.name || "Athlete"}</span>{" "}
              <span className="text-gray-500">({normalizeEmail(selectedAthlete.email)})</span>
              {selectedAthleteToken ? <span className="text-gray-400"> • {selectedAthleteToken}</span> : null}
            </p>
          ) : (
            <p className="text-sm text-gray-500 mt-1">Choose an athlete to begin.</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView("builder")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
              view === "builder"
                ? "bg-[#46769B] text-white border-[#46769B]"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Builder
          </button>
          <button
            type="button"
            onClick={() => setView("history")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
              view === "history"
                ? "bg-[#46769B] text-white border-[#46769B]"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            History
          </button>
        </div>
      </div>
    </div>
  );
}
