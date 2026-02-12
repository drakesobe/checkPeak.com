"use client";

export default function AccountShell({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white p-8 rounded-3xl shadow-md border border-blue-100">
          {children}
        </div>
      </main>
    </div>
  );
}
