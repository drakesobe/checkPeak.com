"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { useAuthContext } from "@/hooks/useAuth";

export default function ScansPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState("My Scans");
  const [scans, setScans] = useState([]);

  useEffect(() => {
    if (!user) router.push("/login");

    if (!user) return;

    async function fetchScans() {
      try {
        const res = await fetch(`/api/getScans?userEmail=${user.Email}`);
        const data = await res.json();
        setScans(data.scans || []);
      } catch (error) {
        console.error(error);
      }
    }

    fetchScans();
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">My Scans</h1>
        <p className="text-gray-600 mb-6">
          Here you can view all your scans.
        </p>

        {scans.length === 0 ? (
          <div className="border rounded-2xl p-6 bg-white shadow-md flex flex-col items-center justify-center">
            <p className="text-gray-500 mb-2">No scans available yet.</p>
            <p className="text-gray-400 text-sm">
              Once you upload or perform scans, they will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {scans.map((scan) => (
              <div
                key={scan.id}
                className="border rounded-2xl p-6 bg-white shadow-md flex justify-between items-center hover:shadow-lg transition"
              >
                <div>
                  <p className="text-gray-800 font-medium">{scan.name}</p>
                  <p className="text-gray-500 text-sm">{scan.date}</p>
                </div>
                <button
                  onClick={() => router.push(`/scans/${scan.id}`)}
                  className="text-blue-600 hover:underline"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
