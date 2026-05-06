// components/account/FeedbackBanner.jsx
// NOTE: This is the single source of feedback for the account page.
// ActionsSection no longer renders its own banner - it receives message/error
// from account.js and delegates display here. Do not add a second banner.
"use client";

import { motion, AnimatePresence } from "framer-motion";

export default function FeedbackBanner({ message, error }) {
  const isError = Boolean(error && !message);
  return (
    <AnimatePresence>
      {(message || error) && (
        <motion.div
          key={message || error}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="text-sm font-medium py-3 px-4 text-center"
          style={{
            backgroundColor: isError ? "#FFF0F0" : "#F0FBF4",
            border: `1px solid ${isError ? "#FFC8C8" : "#A8DFB8"}`,
            borderLeft: `4px solid ${isError ? "#C8102E" : "#00873E"}`,
            color: isError ? "#7A1A1A" : "#1A5C33",
          }}
        >
          {message || error}
        </motion.div>
      )}
    </AnimatePresence>
  );
}