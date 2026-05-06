// pages/athlete/[id].js
"use client";

import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import OCRUpload from "../../components/OCRUpload";
import { motion, AnimatePresence } from "framer-motion";
import { FaFileUpload } from "react-icons/fa";

/**
 * IMPORTANT:
 * This route can collide with reserved slugs like /athlete/nutrition
 * because this file matches /athlete/[id].
 *
 * So we:
 * 1) Only fetch when `id` looks like an Airtable record id (recXXXXXXXXXXXXXXX)
 * 2) Gracefully bail otherwise (do nothing) so /athlete/nutrition pages don't spam /api/get-athlete?id=nutrition
 */

function looksLikeAirtableRecId(v) {
  const s = String(v || "").trim();
  // Airtable record IDs usually look like: rec + 14+ chars (alphanumeric)
  return /^rec[a-zA-Z0-9]{10,}$/.test(s);
}

export default function AthleteProfile() {
  const router = useRouter();
  const { id } = router.query;

  const idStr = useMemo(() => String(id || "").trim(), [id]);
  const canFetch = useMemo(() => looksLikeAirtableRecId(idStr), [idStr]);

  const [athlete, setAthlete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (!idStr) return;

    // ✅ Prevent collisions: if the slug isn't a real athlete record id, bail.
    if (!canFetch) {
      setLoading(false);
      setAthlete(null);
      setError("");
      return;
    }

    const fetchAthlete = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/get-athlete?id=${encodeURIComponent(idStr)}`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data?.error || "Failed to fetch athlete");

        setAthlete(data?.athlete || null);
      } catch (err) {
        console.error("Fetch athlete error:", err);
        setAthlete(null);
        setError(err?.message || "Error loading athlete");
      } finally {
        setLoading(false);
      }
    };

    fetchAthlete();
  }, [idStr, canFetch]);

  // If this is a reserved slug like "nutrition", don't render a scary error page.
  // This prevents confusion during routing/prefetch.
  if (!loading && idStr && !canFetch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow p-6">
          <p className="text-gray-900 font-extrabold text-lg">Not an athlete profile</p>
          <p className="text-gray-600 text-sm mt-1">
            This path is reserved for another athlete page (like nutrition).
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => router.push("/athlete/today")}
              className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
              type="button"
            >
              Go to Today →
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              type="button"
            >
              Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl shadow p-6">
          <p className="text-red-600 font-extrabold text-lg">
            {error || "Athlete not found"}
          </p>
          <p className="text-gray-600 text-sm mt-1">
            If you believe this is a valid athlete profile, double-check the URL contains a valid Airtable record id (rec...).
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 rounded-xl bg-[#46769B] text-white text-sm font-semibold hover:brightness-110"
              type="button"
            >
              Dashboard
            </button>
            <button
              onClick={() => router.back()}
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:bg-gray-50"
              type="button"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Support both shapes: your /api/get-athletes returns { fields: { Name, Email... } }
  // but your /api/get-athlete normalizes to { name, email... } (recommended).
  const displayName = athlete?.name || athlete?.Name || athlete?.fields?.Name || "Athlete";
  const displayTitle = athlete?.title || athlete?.Title || athlete?.fields?.Title || "";
  const displayOrg = athlete?.organization || athlete?.Organization || athlete?.fields?.Organization || "";
  const displayEmail = athlete?.email || athlete?.Email || athlete?.fields?.Email || "";
  const displayPhone = athlete?.phone || athlete?.Phone || athlete?.fields?.Phone || "";
  const athleteIdForUpload = athlete?.id || athlete?.recordId || athlete?.raw?.id || idStr;

  return (
    <>
      <Head>
        <title>PEAK - {displayName}'s Profile</title>
        <meta name="description" content={`Athlete profile for ${displayName} in PEAK`} />
      </Head>

      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        {/* Header */}
        <section className="py-12 bg-blue-600 text-white text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">{displayName}</h1>

          {displayTitle ? <p className="text-lg md:text-xl">{displayTitle}</p> : null}

          {displayOrg ? <p className="mt-1 text-sm">{String(displayOrg)}</p> : null}

          {displayEmail ? <p className="mt-1 text-sm">{displayEmail}</p> : null}

          {displayPhone ? <p className="mt-1 text-sm">📞 {displayPhone}</p> : null}
        </section>

        {/* Upload Section */}
        <section className="py-12 bg-gray-100 text-center">
          <button
            onClick={() => setShowUpload((v) => !v)}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-2xl shadow hover:scale-105 transition"
            type="button"
          >
            <FaFileUpload /> {showUpload ? "Hide Upload" : "Upload Supplement Label"}
          </button>

          <AnimatePresence>
            {showUpload ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.6 }}
                className="max-w-4xl mx-auto mt-6"
              >
                <OCRUpload multiple={true} athleteId={athleteIdForUpload} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        {/* Placeholder Scan History */}
        <section className="py-12 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-bold mb-6 text-center">Scan History</h2>
            <p className="text-gray-500 text-center">
              No scans yet. Upload a label above to get started.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
