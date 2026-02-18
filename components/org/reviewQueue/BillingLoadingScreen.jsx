"use client";

export default function BillingLoadingScreen({ label = "Loading billing status…" }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-3xl shadow-md border border-blue-100 p-6 sm:p-7">
          <p className="text-sm text-gray-600">{label}</p>
        </div>
      </main>
    </div>
  );
}
