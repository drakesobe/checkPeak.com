// components/InviteGenerator.js
import { useState } from "react";
import { motion } from "framer-motion";
import { FaLink, FaClipboard } from "react-icons/fa";

export default function InviteGenerator({ orgId }) {
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);

  const generateLink = async () => {
    // Call your API route to generate a token & store in DB / Airtable
    const res = await fetch("/api/generate-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    const data = await res.json();
    setInviteLink(`${window.location.origin}/athlete-signup/${data.token}`);
    setCopied(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-50 p-6 rounded-xl shadow-lg max-w-md mx-auto space-y-4"
    >
      <h3 className="text-xl font-bold text-gray-700 flex items-center gap-2">
        <FaLink /> Generate Athlete Invite
      </h3>

      <button
        onClick={generateLink}
        className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow hover:bg-blue-700 transition w-full"
      >
        Generate Link
      </button>

      {inviteLink && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            readOnly
            value={inviteLink}
            className="flex-1 p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={copyToClipboard}
            className="bg-green-600 text-white p-3 rounded-xl shadow hover:bg-green-700 transition"
          >
            <FaClipboard />
          </button>
        </div>
      )}

      {copied && <p className="text-green-600 text-sm mt-1">Copied to clipboard!</p>}
    </motion.div>
  );
}
