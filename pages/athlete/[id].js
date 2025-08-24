// pages/athlete/[id].js
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import NavBar from "../../components/NavBar";
import OCRUpload from "../../components/OCRUpload";
import { motion, AnimatePresence } from "framer-motion";
import { FaFileUpload, FaHistory, FaUser } from "react-icons/fa";

export default function AthleteProfile() {
  const router = useRouter();
  const { id } = router.query;
  const [athlete, setAthlete] = useState(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (!id) return;
    // Fetch athlete info from API / DB (placeholder for now)
    const fetchAthlete = async () => {
      // Example static data
      const data = {
        id,
        name: "John Doe",
        sport: "Basketball",
        email: "johndoe@example.com",
        scans: [
          { id: 1, label: "Protein Powder A", result: "No banned substances", date: "2025-08-01" },
          { id: 2, label: "Vitamin Complex B", result: "Contains banned substance: DMAA", date: "2025-08-10" },
        ],
      };
      setAthlete(data);
    };
    fetchAthlete();
  }, [id]);

  if (!athlete) return null;

  return (
    <>
      <Head>
        <title>PEAK — {athlete.name}'s Profile</title>
        <meta name="description" content={`Athlete profile for ${athlete.name} in PEAK`} />
      </Head>

      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <NavBar activeTab="Organization" setActiveTab={() => {}} />

        <section className="py-12 bg-blue-600 text-white text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-2">{athlete.name}</h1>
          <p className="text-lg md:text-xl">{athlete.sport}</p>
          <p className="mt-1 text-sm">{athlete.email}</p>
        </section>

        {/* Upload Section */}
        <section className="py-12 bg-gray-100 text-center">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-2xl shadow hover:scale-105 transition"
          >
            <FaFileUpload /> {showUpload ? "Hide Upload" : "Upload Supplement Label"}
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

        {/* Scan History */}
        <section className="py-12 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-3xl font-bold mb-6 text-center">Scan History</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {athlete.scans.map((scan) => (
                <div key={scan.id} className="p-6 bg-gray-50 rounded-xl shadow hover:shadow-lg transition hover:scale-105">
                  <h3 className="text-xl font-semibold mb-1">{scan.label}</h3>
                  <p className={`text-sm font-medium ${scan.result.includes("banned") ? "text-red-600" : "text-green-600"}`}>
                    {scan.result}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">{scan.date}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
