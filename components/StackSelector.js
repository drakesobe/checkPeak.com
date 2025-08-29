"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import CompareModal from "./CompareModal";

export default function StackSelector({ stacks }) {
  const [selectedStacks, setSelectedStacks] = useState([]);
  const [showModal, setShowModal] = useState(false);

  const toggleStack = (stack) => {
    setSelectedStacks((prev) => {
      if (prev.find((s) => s.id === stack.id)) {
        return prev.filter((s) => s.id !== stack.id);
      } else {
        if (prev.length < 3) return [...prev, stack];
        return prev;
      }
    });
  };

  const canCompare = selectedStacks.length >= 2;

  const handleCompare = () => {
    if (canCompare) setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedStacks([]); // Reset selection on modal close
  };

  return (
    <div className="space-y-6">
      {/* Stack grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {stacks.map((stack) => {
          const isSelected = selectedStacks.find((s) => s.id === stack.id);
          return (
            <motion.div
              key={stack.id}
              className={`border rounded-xl p-4 cursor-pointer relative transition-all ${
                isSelected
                  ? "border-green-500 shadow-lg scale-105 ring-2 ring-green-400"
                  : "border-gray-700"
              }`}
              whileHover={{
                boxShadow: "0 0 15px 3px rgba(0, 255, 204, 0.7)",
                scale: 1.02,
              }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              onClick={() => toggleStack(stack)}
            >
              <img
                src={stack.image || "/fallback-image.svg"}
                alt={stack.name}
                className="w-full h-36 object-cover rounded-md mb-3"
              />
              <h3 className="text-white font-semibold text-center">{stack.name}</h3>

              {isSelected && (
                <span className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  Selected
                </span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Compare button */}
      <div className="flex justify-end mt-4">
        <button
          disabled={!canCompare}
          onClick={handleCompare}
          className={`px-5 py-2 rounded-2xl font-medium text-white ${
            canCompare
              ? "bg-green-600 hover:bg-green-500 shadow-lg"
              : "bg-gray-700 cursor-not-allowed"
          }`}
        >
          Compare {selectedStacks.length} Stack{selectedStacks.length > 1 ? "s" : ""}
        </button>
      </div>

      {/* Compare modal */}
      {showModal && (
        <CompareModal stacks={selectedStacks} onClose={handleModalClose} />
      )}
    </div>
  );
}
