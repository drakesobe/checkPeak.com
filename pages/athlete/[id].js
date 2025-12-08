// pages/athlete/[id].js
"use client";

import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import OCRUpload from "../../components/OCRUpload";
import { motion, AnimatePresence } from "framer-motion";
import { FaFileUpload } from "react-icons/fa";

export default function AthleteProfile() {
  const router = useRouter();
  const { id } = router.query;
  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchAthlete = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/get-athlete?id=${id}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data?.error || "Failed to fetch athlete");

        setAthlete(data.athlete);
      } catch (err) {
        console.error("Fetch athlete error:", err);
        setError(err.message || "Error loading athlete");
      } finally {
        setLoading(false);
      }
    };

    fetchAthlete();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-600 text-lg">Loading athlete profile...</p>
      </div>
    );
  }

  if (error || !athlete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-600 font-medium">
          {error || "Athlete not found"}
        </p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>PEAK — {athlete.Name}'s Profile</title>
        <meta
          name="description"
          content={`Athlete profile for ${athlete.Name} in PEAK`}
        />
      </Head>

      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">

        {/* Header */}
        <section className="py-12 bg-blue-600 text-white text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">
            {athlete.Name}
          </h1>
          {athlete.Title && (
            <p className="text-lg md:text-xl">{athlete.Title}</p>
          )}
          {athlete.Organization && (
            <p className="mt-1 text-sm">{athlete.Organization}</p>
          )}
          <p className="mt-1 text-sm">{athlete.Email}</p>
          {athlete.Phone && (
            <p className="mt-1 text-sm">📞 {athlete.Phone}</p>
          )}
        </section>

        {/* Upload Section */}
        <section className="py-12 bg-gray-100 text-center">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-2xl shadow hover:scale-105 transition"
          >
            <FaFileUpload />{" "}
            {showUpload ? "Hide Upload" : "Upload Supplement Label"}
          </button>

          <AnimatePresence>
            {showUpload && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.6 }}
                className="max-w-4xl mx-auto mt-6"
              >
                <OCRUpload multiple={true} athleteId={athlete.id} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Placeholder Scan History (future: tie into Airtable scans table) */}
        <section className="py-12 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-bold mb-6 text-center">
              Scan History
            </h2>
            <p className="text-gray-500 text-center">
              No scans yet. Upload a label above to get started.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
