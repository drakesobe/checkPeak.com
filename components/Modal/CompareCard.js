"use client";

import React, { useMemo } from "react";
import ValueRatingSlim from "./modal/ValueRatingSlim";

export default function CompareCard({
  stack,
  selectedCompareStacks,
  setSelectedCompareStacks,
  openCompareModal,
  // ✅ IMPORTANT: if CompareCard is used in a .map(), set this to false
  // and render the sticky compare bar once at the page level.
  showStickyCompareBar = true,
}) {
  const isSelected = selectedCompareStacks.some((s) => s.id === stack.id);
  const selectedCount = selectedCompareStacks.length;

  const toggleCompare = () => {
    if (isSelected) {
      setSelectedCompareStacks(
        selectedCompareStacks.filter((s) => s.id !== stack.id)
      );
    } else if (selectedCompareStacks.length < 3) {
      setSelectedCompareStacks([...selectedCompareStacks, stack]);
    }
  };

  const productImage =
    stack?.imageUrl ||
    stack?.nutritionLabel ||
    stack?.image ||
    stack?.rawFields?.["Image URL"] ||
    stack?.rawFields?.["Nutrition Label URL"] ||
    stack?.rawFields?.["Image"] ||
    "";

  const stackName = stack?.name || stack?.rawFields?.Name || "Unknown Product";
  const stackBrand = stack?.brand || stack?.rawFields?.Brand || "Unknown Brand";

  const servingsRaw =
    stack?.servings ??
    stack?.rawFields?.Servings ??
    stack?.rawFields?.["Servings"] ??
    null;

  const priceRaw =
    stack?.price ??
    stack?.rawFields?.Price ??
    stack?.rawFields?.["Price"] ??
    null;

  const valueScore =
    stack?.rating ??
    stack?.valueScore ??
    stack?.rawFields?.Rating ??
    stack?.rawFields?.["Value Score"] ??
    null;

  const servings = useMemo(() => {
    if (servingsRaw === null || servingsRaw === undefined) return null;
    const n = Number(servingsRaw);
    return Number.isFinite(n) ? n : String(servingsRaw);
  }, [servingsRaw]);

  const price = useMemo(() => {
    if (priceRaw === null || priceRaw === undefined || priceRaw === "") return null;
    const n = Number(priceRaw);
    return Number.isFinite(n) ? n : null;
  }, [priceRaw]);

  const compareLabel = `Compare ${selectedCount} Stack${selectedCount > 1 ? "s" : ""}`;

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
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") toggleCompare();
        }}
        aria-pressed={isSelected}
        aria-label={`${isSelected ? "Remove" : "Add"} ${stackName} to compare`}
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
                // Avoid infinite loops
                if (!e.currentTarget.dataset.fallback) {
                  e.currentTarget.dataset.fallback = "1";
                  e.currentTarget.src = "/fallback-image.svg";
                }
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
        {valueScore !== null && valueScore !== undefined && (
          <div className="mt-2">
            <ValueRatingSlim valueScore={valueScore} />
          </div>
        )}

        {/* Meta: servings / price */}
        <div className="mt-2 text-xs sm:text-sm text-gray-300 space-y-0.5">
          {servings !== null && (
            <p>
              <span className="font-semibold text-gray-100">Servings:</span>{" "}
              {servings}
            </p>
          )}
          {price !== null && (
            <p>
              <span className="font-semibold text-gray-100">Price:</span>{" "}
              ${price.toFixed(2)}
            </p>
          )}
        </div>

        {/* Affiliate CTA */}
        {stack?.affiliateLink && (
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

      {/* Sticky Compare Button (render once!) */}
      {showStickyCompareBar && selectedCount >= 2 && (
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
                You’re viewing {selectedCount} stack{selectedCount > 1 ? "s" : ""} — open the comparison modal
                to see them side-by-side.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
