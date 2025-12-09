"use client";

import React, { useEffect, useState } from "react";
import ValueRatingSlim from "./modal/ValueRatingSlim";

export default function CompareCard({
  stack,
  selectedCompareStacks,
  setSelectedCompareStacks,
  openCompareModal,
}) {
  const isSelected = selectedCompareStacks.some((s) => s.id === stack.id);
  const selectedCount = selectedCompareStacks.length;

  const toggleCompare = () => {
    if (isSelected) {
      setSelectedCompareStacks(selectedCompareStacks.filter((s) => s.id !== stack.id));
    } else if (selectedCompareStacks.length < 3) {
      setSelectedCompareStacks([...selectedCompareStacks, stack]);
    }
  };

  const productImage =
    stack.nutritionLabel ||
    stack.image ||
    stack.rawFields?.["Image"] ||
    "";

  const stackName = stack.name || stack.rawFields?.Name || "Unknown Product";
  const stackBrand = stack.brand || stack.rawFields?.Brand || "Unknown Brand";

  const servings =
    stack.servings ??
    stack.rawFields?.Servings ??
    stack.rawFields?.["Servings"] ??
    null;

  const price =
    stack.price ??
    stack.rawFields?.Price ??
    stack.rawFields?.["Price"] ??
    null;

  const valueScore =
    stack.rating ??
    stack.valueScore ??
    stack.rawFields?.Rating ??
    stack.rawFields?.["Value Score"];

  // Responsive label shrink for very narrow devices
  const [isVeryNarrow, setIsVeryNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 360px)");
    const update = (e) => setIsVeryNarrow(!!e.matches);

    setIsVeryNarrow(!!mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);

  const compareLabel = isVeryNarrow
    ? "Compare"
    : `Compare ${selectedCount} Stack${selectedCount > 1 ? "s" : ""}`;

  return (
    <>
      {/* Product Card */}
      <div
        onClick={toggleCompare}
        className={`relative bg-gray-900 rounded-2xl p-4 shadow-md hover:shadow-xl cursor-pointer transition-all duration-150 border ${
          isSelected
            ? "border-emerald-400 ring-2 ring-emerald-400/40"
            : "border-gray-800 hover:border-gray-600"
        }`}
      >
        {/* Selected overlay + pill */}
        {isSelected && (
          <>
            <div className="absolute inset-0 rounded-2xl bg-emerald-400/5 pointer-events-none" />
            <div className="absolute top-3 right-3 z-10">
              <span className="inline-flex items-center rounded-full bg-emerald-600/90 text-white text-[10px] font-semibold px-2 py-0.5 shadow-sm">
                Selected
              </span>
            </div>
          </>
        )}

        {/* Image */}
        <div className="relative mb-3">
          {productImage ? (
            <img
              src={productImage}
              alt={stackName}
              loading="lazy"
              className="w-full h-40 sm:h-44 object-contain rounded-xl bg-gray-800 border border-gray-700"
              onError={(e) => {
                e.currentTarget.src = "/fallback-image.svg";
                e.currentTarget.classList.add("object-contain");
              }}
            />
          ) : (
            <div className="w-full h-40 sm:h-44 bg-gray-800 flex items-center justify-center text-gray-400 rounded-xl border border-gray-700 text-xs">
              No Image Available
            </div>
          )}
        </div>

        {/* Name + brand */}
        <div className="relative z-10 space-y-0.5">
          <h3 className="text-base sm:text-lg font-semibold text-white truncate">
            {stackName}
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 truncate">
            {stackBrand}
          </p>
        </div>

        {/* Value rating */}
        {valueScore !== undefined && valueScore !== null && (
          <div className="mt-2">
            <ValueRatingSlim valueScore={valueScore} />
          </div>
        )}

        {/* Meta: servings / price */}
        <div className="mt-2 text-xs sm:text-sm text-gray-300 space-y-0.5">
          {servings && (
            <p>
              <span className="font-semibold text-gray-100">Servings:</span>{" "}
              {servings}
            </p>
          )}
          {price && !Number.isNaN(Number(price)) && (
            <p>
              <span className="font-semibold text-gray-100">Price:</span>{" "}
              ${Number(price).toFixed(2)}
            </p>
          )}
        </div>

        {/* Affiliate CTA */}
        {stack.affiliateLink && (
          <a
            href={stack.affiliateLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center bg-[#46769B] hover:bg-[#3b5c81] text-white font-semibold px-3 py-2 rounded-xl text-xs sm:text-sm shadow-sm transition-colors"
            onClick={(e) => e.stopPropagation()} // don’t toggle compare when clicking link
          >
            Get This Stack
          </a>
        )}

        {/* Helper text */}
        <p className="mt-2 text-[11px] text-gray-400">
          {isSelected
            ? "Selected for comparison. You can choose up to 3."
            : "Tap to select for comparison (up to 3 stacks)."}
        </p>
      </div>

      {/* Sticky Compare Button (only if 2+ selected) */}
      {selectedCount >= 2 && (
        <>
          {/* Mobile sticky button */}
          <div
            className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-gray-950/95 border-t border-gray-800 shadow-[0_-4px_18px_rgba(0,0,0,0.6)] z-50 md:hidden backdrop-blur"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            <button
              onClick={openCompareModal}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-2xl shadow-md text-base active:scale-[0.98] transition-transform"
            >
              {compareLabel}
            </button>
            <p className="mt-1 text-[11px] text-gray-400 text-center">
              Compare ingredients and banned flags side-by-side.
            </p>
          </div>

          {/* Desktop sticky button */}
          <div className="hidden md:flex fixed bottom-0 left-0 right-0 justify-center px-4 py-4 bg-gray-950/95 border-t border-white/10 shadow-[0_-6px_30px_rgba(0,0,0,0.85)] z-50 backdrop-blur">
            <div className="flex flex-col items-center w-full max-w-3xl gap-1">
              <button
                onClick={openCompareModal}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-2xl text-lg shadow-lg active:scale-[0.985] transition-transform"
              >
                {compareLabel}
              </button>
              <p className="text-xs text-gray-300">
                You’re viewing {selectedCount} stack
                {selectedCount > 1 ? "s" : ""} &mdash; open the comparison modal
                to see them side-by-side.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
