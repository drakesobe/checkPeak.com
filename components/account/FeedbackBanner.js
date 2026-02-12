import { motion, AnimatePresence } from "framer-motion";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function FeedbackBanner({ message, error }) {
  return (
    <AnimatePresence>
      {(message || error) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={classNames(
            "text-center text-sm font-medium py-3 px-4 rounded-2xl border mt-6",
            message
              ? "bg-emerald-50 text-emerald-800 border-emerald-100"
              : "bg-red-50 text-red-700 border-red-100"
          )}
        >
          {message || error}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
