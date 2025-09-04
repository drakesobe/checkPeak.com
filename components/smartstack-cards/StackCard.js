"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaDumbbell,
  FaBolt,
  FaLeaf,
  FaCoffee,
  FaAppleAlt,
  FaCapsules,
  FaHeart,
} from "react-icons/fa";
import ValueBadge from "./ValueBadge";
import { useAuthContext } from "@/hooks/useAuth";

// Map common supplements to icons
const supplementIcons = {
  Caffeine: <FaCoffee />,
  "L-Theanine": <FaLeaf />,
  "B-Vitamins": <FaCapsules />,
  "Creatine Monohydrate": <FaDumbbell />,
  "L-Glutamine": <FaLeaf />,
  BCAAs: <FaDumbbell />,
  "Omega-3": <FaCapsules />,
  "Bacopa Monnieri": <FaLeaf />,
  "Rhodiola Rosea": <FaLeaf />,
  "Beta-Alanine": <FaDumbbell />,
  "L-Citrulline": <FaLeaf />,
  Electrolytes: <FaBolt />,
  "Vitamin C": <FaAppleAlt />,
  Zinc: <FaCapsules />,
  Elderberry: <FaAppleAlt />,
};

export default function StackCard({
  stack,
  setModalStack,
  selectedCompareStacks,
  setSelectedCompareStacks,
  savedStacks,
  setSavedStacks,
}) {
  const { user } = useAuthContext();
  // Robust email handling for different cases
  const userEmail = (user?.Email || user?.email || "").toLowerCase() || null;

  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSavedText, setShowSavedText] = useState(false);

  // Fetch saved stacks on mount to ensure isSaved is correct
  useEffect(() => {
    if (!userEmail) return;
    const fetchSaved = async () => {
      try {
        const res = await fetch(
          `/api/getSavedStacks?UserEmail=${encodeURIComponent(userEmail)}&t=${Date.now()}`
        );
        if (!res.ok) throw new Error("Failed to fetch saved stacks");
        const data = await res.json();
        const normalizedSaved = (data.savedStacks || []).map((s) => ({
          ...s,
          StackID: s.StackID?.toString() || s.id?.toString(),
        }));
        setSavedStacks(normalizedSaved);
        setIsSaved(normalizedSaved.some((s) => s.StackID === stack.id));
      } catch (err) {
        console.error(err);
      }
    };
    fetchSaved();
  }, [userEmail, stack.id]);

  const isSelected = selectedCompareStacks.some((s) => s.id === stack.id);

  // Toggle compare selection
  const toggleCompare = (e) => {
    e.stopPropagation();
    if (isSelected) {
      setSelectedCompareStacks(selectedCompareStacks.filter((s) => s.id !== stack.id));
    } else if (selectedCompareStacks.length < 3) {
      setSelectedCompareStacks([...selectedCompareStacks, stack]);
    }
  };

  // Save/remove stack
  const toggleSave = async (e) => {
    e.stopPropagation();
    if (!userEmail) {
      alert("You must be logged in to save a stack.");
      return;
    }

    setSaving(true);
    try {
      if (!isSaved) {
        // Save
        const res = await fetch("/api/saveStack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ UserEmail: userEmail, stack }),
        });
        if (!res.ok) throw new Error("Failed to save stack");
        const data = await res.json();
        const normalizedSaved = (data.savedStacks || []).map((s) => ({
          ...s,
          StackID: s.StackID?.toString() || s.id?.toString(),
        }));
        setSavedStacks(normalizedSaved);
        setIsSaved(true);
      } else {
        // Remove
        const record = savedStacks.find((s) => s.StackID === stack.id);
        if (record?.recordId) {
          const res = await fetch("/api/removeSavedStack", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ UserEmail: userEmail, recordId: record.recordId }),
          });
          if (!res.ok) throw new Error("Failed to remove saved stack");
          const data = await res.json();
          const normalizedSaved = (data.savedStacks || []).map((s) => ({
            ...s,
            StackID: s.StackID?.toString() || s.id?.toString(),
          }));
          setSavedStacks(normalizedSaved);
          setIsSaved(false);
        }
      }
      setShowSavedText(true);
      setTimeout(() => setShowSavedText(false), 1500);
    } catch (err) {
      console.error(err);
      alert("Failed to update saved stack. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className={`relative bg-gradient-to-br from-gray-800 to-gray-700 p-5 rounded-2xl shadow-lg cursor-pointer flex flex-col transition-transform hover:scale-105 hover:shadow-2xl ${
        isSelected ? "ring-4 ring-green-500" : ""
      }`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      onClick={() => stack.nutritionLabel && setModalStack(stack)}
    >
      {/* Compare Checkbox */}
      <motion.button
        onClick={toggleCompare}
        className={`absolute top-3 right-10 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
          isSelected
            ? "bg-green-500 border-green-600 text-white"
            : "bg-gray-900 border-gray-600 text-transparent"
        }`}
        whileHover={{ scale: 1.2 }}
        transition={{ type: "spring", stiffness: 300 }}
        title={isSelected ? "Remove from compare" : "Select for compare (max 3)"}
      >
        {isSelected ? "✕" : "✓"}
      </motion.button>

      {/* Image */}
      {stack.imageUrl ? (
        <img
          src={stack.imageUrl}
          alt={stack.name}
          className="w-full h-52 md:h-56 lg:h-60 object-cover rounded-xl mb-4 flex-shrink-0 border border-gray-600"
          onError={(e) => (e.currentTarget.src = "/fallback-image.svg")}
        />
      ) : (
        <div className="w-full h-52 md:h-56 lg:h-60 bg-gray-700 flex items-center justify-center rounded-xl mb-4 text-gray-400 text-sm border border-gray-600">
          No Image Available
        </div>
      )}

      {/* Stack Name */}
      <h3 className="text-2xl md:text-2xl font-bold mb-2 text-white truncate">{stack.name}</h3>

      {/* Supplements Icons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Array.isArray(stack.supplements) &&
          stack.supplements.map((supp) => (
            <span
              key={supp}
              className="flex items-center gap-1 px-3 py-1 bg-gray-600 rounded-full text-xs md:text-sm text-white font-medium shadow-sm"
            >
              {supplementIcons[supp] || <FaCapsules />}
            </span>
          ))}
      </div>

      {/* Value Badge */}
      {stack.valueScore != null && !isNaN(stack.valueScore) && (
        <div className="flex flex-wrap gap-2 mb-3">
          <ValueBadge valueScore={stack.valueScore} category={stack.category} />
        </div>
      )}

      {/* Notes */}
      {stack.notes && (
        <p className="text-gray-300 text-sm md:text-base mb-4 line-clamp-4">{stack.notes}</p>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-auto flex-wrap">
        {stack.affiliateLink && (
          <a
            href={stack.affiliateLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-[#46769B] hover:bg-[#375b7a] rounded-2xl text-white text-sm md:text-base font-semibold shadow-sm transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            See Price
          </a>
        )}

        {stack.nutritionLabel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setModalStack(stack);
            }}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-2xl text-white text-sm md:text-base font-semibold transition-colors"
          >
            View Nutrition
          </button>
        )}
      </div>

      {/* Compare Hint */}
      <p className="mt-2 text-gray-400 text-xs md:text-sm">
        {isSelected
          ? `Selected for comparison (${selectedCompareStacks.length}/3)`
          : "Click the ✓ to select for comparison (up to 3)"}
      </p>

      {/* Heart / Saved */}
      <div className="absolute bottom-3 right-3">
        <motion.div
          onClick={toggleSave}
          className="cursor-pointer w-8 h-8 relative"
          whileTap={{ scale: 0.8 }}
        >
          <motion.div
            key={isSaved ? "filled" : "outline"}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 500 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <FaHeart size={24} className={isSaved ? "text-red-500" : "text-gray-400"} />
          </motion.div>
        </motion.div>

        {showSavedText && (
          <span className="absolute -top-5 text-green-400 text-xs font-bold">
            {isSaved ? "Saved!" : "Unsaved!"}
          </span>
        )}
      </div>
    </motion.div>
  );
}
