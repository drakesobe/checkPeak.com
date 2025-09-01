import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import NavBar from "@/components/NavBar";
import { useAuthContext } from "@/hooks/useAuth";

export default function ScanDetailPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState("My Scans");
  const [scan, setScan] = useState(null);
  const { id } = router.query; // get dynamic scan ID from URL

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!id) return; // wait for ID from router

    async function fetchScan() {
      try {
        const res = await fetch(`/api/getScanById?id=${id}`);
        const data = await res.json();
        if (!data.scan) {
          router.push("/scans"); // redirect if scan not found
        } else {
          setScan(data.scan);
        }
      } catch (error) {
        console.error("Failed to fetch scan:", error);
        router.push("/scans");
      }
    }

    fetchScan();
  }, [user, router, id]);

  if (!user || !scan) return null; // wait for auth / data

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{scan.name}</h1>
        <p className="text-gray-500 mb-4">Date: {scan.date}</p>

        {scan.summary && (
          <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Summary</h2>
            <p className="text-gray-700">{scan.summary}</p>
          </div>
        )}

        {scan.stackDetails && (
          <div className="bg-white p-6 rounded-2xl shadow-md border border-blue-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Stack Details</h2>
            <p className="text-gray-700">{scan.stackDetails}</p>
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
