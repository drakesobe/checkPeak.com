// pages/scans/[id].js
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import NavBar from "@/components/NavBar";
import { useAuthContext } from "@/hooks/useAuth";

export default function ScanDetailPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState("My Scans");
  const [scan, setScan] = useState(null);
  const { id } = router.query;

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!id) return;

    async function fetchScan() {
      try {
        const res = await fetch(`/api/getScanById?id=${id}`);
        const data = await res.json();
        if (!data.scan) {
          router.push("/scans");
        } else {
          setScan(data.scan);
          setNameInput(data.scan.name || "");
        }
      } catch (error) {
        console.error("Failed to fetch scan:", error);
        router.push("/scans");
      }
    }

    fetchScan();
  }, [user, router, id]);

  async function handleSaveName() {
    if (!scan || !nameInput.trim()) return;
    try {
      setSavingName(true);
      const res = await fetch("/api/updateScanName", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: scan.id,
          newName: nameInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        console.error("Failed to update scan name:", data.error);
        setSavingName(false);
        return;
      }

      setScan((prev) =>
        prev ? { ...prev, name: nameInput.trim() } : prev
      );
      setEditingName(false);
      setSavingName(false);
    } catch (err) {
      console.error("Error saving scan name:", err);
      setSavingName(false);
    }
  }

  if (!user || !scan) return null;

  // Date formatting
  let formattedDate = scan.date;
  try {
    if (scan.date) {
      formattedDate = new Date(scan.date).toLocaleString();
    }
  } catch {
    // keep raw
  }

  const prohibitedCount = scan.prohibitedCount || 0;
  const limitedCount = scan.limitedCount || 0;
  const otherCount = scan.otherCount || 0;
  const totalBanned = prohibitedCount + limitedCount + otherCount;

  let riskLabel = "Safe";
  let pillClasses =
    "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800";

  if (prohibitedCount > 0) {
    riskLabel = `${prohibitedCount} Prohibited${
      limitedCount ? `, ${limitedCount} Limited` : ""
    }`;
    pillClasses =
      "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800";
  } else if (limitedCount > 0 || otherCount > 0) {
    const limitedText = limitedCount ? `${limitedCount} Limited` : "";
    const otherText = otherCount ? `${otherCount} Other` : "";
    riskLabel = [limitedText, otherText].filter(Boolean).join(", ") || "Limited";
    pillClasses =
      "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-800";
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        {/* Header with rename + pill */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            {editingName ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm sm:text-base"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  disabled={savingName}
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || !nameInput.trim()}
                  className="bg-blue-600 text-white text-sm px-3 py-1 rounded-md hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {savingName ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => {
                    setEditingName(false);
                    setNameInput(scan.name || "");
                  }}
                  disabled={savingName}
                  className="text-gray-600 text-sm hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-800">
                  {scan.name || "Unnamed Scan"}
                </h1>
                <button
                  onClick={() => setEditingName(true)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Rename
                </button>
              </div>
            )}

            <p className="text-gray-500 text-sm">
              Date: {formattedDate || "Unknown"}
            </p>
          </div>

          {/* Risk pill */}
          <div className="flex flex-col items-start sm:items-end gap-1">
            <span className={pillClasses}>
              {riskLabel || "Safe"}
            </span>
            {totalBanned > 0 && (
              <p className="text-xs text-gray-600">
                Total banned hits: {totalBanned}
              </p>
            )}
          </div>
        </div>

        {scan.summary && (
          <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Summary
            </h2>
            <p className="text-gray-700 whitespace-pre-line">
              {scan.summary}
            </p>
          </div>
        )}

        {scan.stackDetails && (
          <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Stack Details
            </h2>
            <p className="text-gray-700 whitespace-pre-line">
              {scan.stackDetails}
            </p>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => router.push("/scans")}
            className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-2xl hover:bg-blue-700 transition"
          >
            Back to My Scans
          </button>
        </div>
      </main>
    </div>
  );
}
