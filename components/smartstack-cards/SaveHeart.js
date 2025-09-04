"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FaHeart } from "react-icons/fa";

export default function SaveHeart({ saved, toggleSave }) {
  return (
    <motion.div
      onClick={(e) => {
        e.stopPropagation();
        toggleSave();
      }}
      className="cursor-pointer w-8 h-8 relative"
      whileTap={{ scale: 0.8 }}
    >
      <AnimatePresence mode="wait">
        {saved ? (
          <motion.div
            key="saved" // key differentiates saved/unsaved
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500 }}
            className="absolute inset-0 flex items-center justify-center text-red-500"
            title="Saved"
          >
            <FaHeart size={24} />
          </motion.div>
        ) : (
          <motion.div
            key="unsaved"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500 }}
            className="absolute inset-0 flex items-center justify-center text-gray-400"
            title="Save Stack"
          >
            <FaHeart size={24} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
