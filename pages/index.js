// pages/home.js
import { useState } from "react";
import NavBar from "../components/NavBar";
import Link from "next/link";

export default function HomePage() {
  const [userType, setUserType] = useState("");

  const handleSelect = (type) => setUserType(type);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <NavBar activeTab="" setActiveTab={() => {}} />

      <main className="max-w-4xl mx-auto px-4 py-20 space-y-12 text-center">
        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900">
          Welcome to CheckPeak
        </h1>
        <p className="text-lg md:text-xl text-gray-700 max-w-2xl mx-auto">
          Ensure your supplements and substances are safe for competition. Please note: 
          this tool is not 100% comprehensive. Athletes and users should always verify with 
          their head athletic trainer or sports nutritionist before consuming any substances.
        </p>

        {/* User Type Selection */}
        <div className="flex flex-col md:flex-row justify-center gap-8 mt-8">
          <button
            onClick={() => handleSelect("individual")}
            className={`px-8 py-6 rounded-2xl text-white font-semibold shadow-md transition-colors hover:brightness-110 ${
              userType === "individual" ? "bg-blue-700" : "bg-[#46769B]"
            }`}
          >
            I am an Individual
          </button>

          <button
            onClick={() => handleSelect("organization")}
            className={`px-8 py-6 rounded-2xl text-white font-semibold shadow-md transition-colors hover:brightness-110 ${
              userType === "organization" ? "bg-blue-700" : "bg-[#46769B]"
            }`}
          >
            I am an Organization
          </button>
        </div>

        {/* Conditional CTA / Navigation */}
        {userType && (
          <div className="mt-12">
            {userType === "individual" && (
              <Link href="/ocr">
                <a className="px-10 py-4 bg-green-600 text-white font-bold rounded-2xl shadow-lg hover:bg-green-700 transition">
                  Start Scanning as Individual
                </a>
              </Link>
            )}
            {userType === "organization" && (
              <Link href="/organization">
                <a className="px-10 py-4 bg-purple-600 text-white font-bold rounded-2xl shadow-lg hover:bg-purple-700 transition">
                  Start as Organization
                </a>
              </Link>
            )}
          </div>
        )}

        {/* Disclaimer Section */}
        <div className="mt-16 max-w-3xl mx-auto p-6 bg-yellow-100 border-l-4 border-yellow-400 rounded-lg text-left text-yellow-900">
          <p className="font-semibold mb-2">⚠️ Important Notice:</p>
          <p>
            CheckPeak provides guidance on banned substances based on our database and OCR analysis. 
            It is <strong>not 100% comprehensive</strong>. Users and athletes must confirm with their 
            head athletic trainer, sports nutritionist, or relevant authority before consuming any substances.
          </p>
        </div>
      </main>
    </div>
  );
}
