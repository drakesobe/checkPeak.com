// components/org/athletes/AthletesList.jsx
"use client";

import { formatDateTime, statusPillClass } from "@/lib/org/athletes/utils";

export default function AthletesList({
  paged,
  selectedIds,
  toggleSelect,
  openDrawer,
  isDone,
  isStarred,
  toggleStarred,
  toggleDone,
  openPrescriptions,
  copyEmail,
  activeRowId,
  setActiveRowId,
  cardClass,
}) {
  return (
    <div className={`${cardClass} p-6`}>
      {paged.length === 0 ? (
        <div className="text-sm text-gray-600">No athletes found. Try clearing filters/search.</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {paged.map((a) => (
              <div key={a.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} />
                      <button type="button" onClick={() => openDrawer(a.id)} className="text-left min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{a.name}</p>
                        <p className="text-xs text-gray-500 mt-1 truncate">{a.title}</p>
                      </button>
                    </div>

                    <p className="text-xs text-gray-600 mt-2 truncate">
                      {a.email ? a.email : <span className="text-red-600 font-semibold">Missing email</span>}
                    </p>

                    <p className="text-[11px] text-gray-500 mt-1">Created: {formatDateTime(a.createdAt)}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button
                      className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                        isStarred(a.id)
                          ? "bg-yellow-400 border-yellow-300 text-gray-900"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                      onClick={() => toggleStarred(a.id)}
                      title="Star"
                    >
                      ★
                    </button>

                    <span className={`text-xs px-2 py-1 rounded-lg border ${statusPillClass(a)}`}>
                      {a.email ? "Ready" : "Incomplete"}
                    </span>

                    <button
                      className={`text-xs px-2 py-1 rounded-lg border ${
                        isDone(a.id)
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                      }`}
                      onClick={() => toggleDone(a.id, false)}
                      title="Toggle done"
                    >
                      {isDone(a.id) ? "Done" : "Not done"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openPrescriptions(a.email)}
                    className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                    disabled={!a.email}
                  >
                    Prescriptions
                  </button>
                  <button
                    type="button"
                    onClick={() => copyEmail(a.email)}
                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50 disabled:opacity-50"
                    disabled={!a.email}
                  >
                    Copy Email
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openDrawer(a.id)}
                    className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50"
                  >
                    Quick View
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDone(a.id, false)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                      isDone(a.id) ? "bg-emerald-600 text-white border-emerald-600" : "bg-white border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {isDone(a.id) ? "✓ Done" : "Mark done"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <p className="text-xs text-gray-500 mb-3">Single click highlight • Double click Quick View</p>

            <div className="max-h-[560px] overflow-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
                  <tr className="text-left text-gray-500">
                    <th className="py-3 px-3 w-[44px]">Sel</th>
                    <th className="py-3 px-3 w-[44px]">★</th>
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Title</th>
                    <th className="py-3 px-3">Created</th>
                    <th className="py-3 px-3 w-[110px]">Done</th>
                    <th className="py-3 px-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paged.map((a) => (
                    <tr
                      key={a.id}
                      className={`border-b last:border-b-0 hover:bg-gray-50 ${activeRowId === a.id ? "bg-blue-50" : ""}`}
                      onClick={() => setActiveRowId(a.id)}
                      onDoubleClick={() => openDrawer(a.id)}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>

                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleStarred(a.id);
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                            isStarred(a.id)
                              ? "bg-yellow-400 border-yellow-300 text-gray-900"
                              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
                          title="Star"
                        >
                          ★
                        </button>
                      </td>

                      <td className="py-3 px-3 font-semibold text-gray-900">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(a.id);
                          }}
                          className="hover:underline text-left"
                        >
                          {a.name}
                        </button>
                      </td>

                      <td className="py-3 px-3 text-gray-700">
                        {a.email ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{a.email}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyEmail(a.email);
                              }}
                              className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold hover:bg-gray-50"
                              title="Copy email"
                            >
                              Copy
                            </button>
                          </div>
                        ) : (
                          <span className="text-red-600 font-semibold">Missing email</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-gray-700">{a.title}</td>

                      <td className="py-3 px-3 text-gray-500">{formatDateTime(a.createdAt)}</td>

                      <td className="py-3 px-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDone(a.id, false);
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                            isDone(a.id)
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {isDone(a.id) ? "✓ Done" : "Mark"}
                        </button>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openPrescriptions(a.email);
                            }}
                            className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                            disabled={!a.email}
                          >
                            Prescriptions
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDrawer(a.id);
                            }}
                            className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold hover:bg-gray-50"
                          >
                            Quick View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-[11px] text-gray-500 leading-relaxed">
              Done/Star/Notes + Saved Views are stored locally for speed. Exports include coach notes.
            </p>
          </div>
        </>
      )}
    </div>
  );
}