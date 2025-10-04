"use client";

import React from "react";
import ValueRatingSlim from "./modal/ValueRatingSlim";

export default function CompareCard({
  stack,
  selectedCompareStacks,
  setSelectedCompareStacks,
  openCompareModal,
}) {
  const isSelected = selectedCompareStacks.some((s) => s.id === stack.id);

  const toggleCompare = () => {
    if (isSelected) {
      setSelectedCompareStacks(selectedCompareStacks.filter((s) => s.id !== stack.id));
    } else if (selectedCompareStacks.length < 3) {
      setSelectedCompareStacks([...selectedCompareStacks, stack]);
    }
  };

  const productImage =
    stack.nutritionLabel || stack.image || stack.rawFields?.["Image"] || "";
  const stackName = stack.name || "Unknown Product";
  const stackBrand = stack.brand || stack.rawFields?.Brand || "Unknown Brand";

  return (
    <>
      {/* Product Card */}
      <div
        onClick={toggleCompare}
        className={`bg-gray-800 rounded-lg p-4 shadow-md hover:shadow-lg cursor-pointer transition relative border-2 ${
          isSelected ? "border-green-500" : "border-transparent"
        }`}
      >
        {isSelected && (
          <div className="absolute inset-0 bg-green-500/20 rounded-lg pointer-events-none"></div>
        )}

        {productImage ? (
          <img
            src={productImage}
            alt={stackName}
            className="w-full h-40 object-contain rounded mb-3 border border-gray-600"
          />
        ) : (
          <div className="w-full h-40 bg-gray-600 flex items-center justify-center text-gray-400 mb-3 rounded text-xs">
            No Image
          </div>
        )}

        <h3 className="text-lg font-semibold text-white truncate">{stackName}</h3>
        <p className="text-gray-400 text-sm truncate">{stackBrand}</p>

        {stack.rating !== undefined && (
          <div className="mt-2">
            <ValueRatingSlim valueScore={stack.rating} />
          </div>
        )}

        <div className="mt-2 text-gray-300 text-sm space-y-0.5">
          {stack.servings && (
            <p>
              <span className="font-semibold">Servings:</span> {stack.servings}
            </p>
          )}
          {stack.price && (
            <p>
              <span className="font-semibold">Price:</span> $
              {Number(stack.price).toFixed(2)}
            </p>
          )}
        </div>

        {stack.affiliateLink && (
          <a
            href={stack.affiliateLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 w-full text-center bg-[#46769B] hover:bg-[#3b5c81] text-white font-semibold px-2 py-1 rounded-md text-sm"
          >
            Get This Stack
          </a>
        )}

        <p className="mt-2 text-gray-400 text-xs">
          {isSelected
            ? "Selected for comparison"
            : "Click to select for comparison (up to 3)"}
        </p>
      </div>

      {/* Sticky Compare Button */}
      {selectedCompareStacks.length >= 2 && (
        <>
          {/* Mobile */}
          <div
            className="fixed bottom-0 left-0 right-0 px-4 py-3 bg-gray-900/95 border-t border-gray-700 shadow-lg z-50 md:hidden"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
          >
            <button
              onClick={openCompareModal}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-xl shadow-md text-lg truncate"
            >
              {/* Short label for small screens */}
              <span className="sm:hidden">Compare</span>
              {/* Full label for bigger screens */}
              <span className="hidden sm:inline">
                Compare {selectedCompareStacks.length} Stack
                {selectedCompareStacks.length > 1 ? "s" : ""}
              </span>
            </button>
          </div>

          {/* Desktop */}
          <div className="hidden md:flex fixed bottom-0 left-0 right-0 justify-center px-4 py-4 bg-gray-900 border-t border-white/10 shadow-lg z-50">
            <button
              onClick={openCompareModal}
              className="w-full max-w-3xl bg-green-600 hover:bg-green-500 text-white font-semibold py-3 rounded-2xl text-lg"
            >
              Compare {selectedCompareStacks.length} Stack
              {selectedCompareStacks.length > 1 ? "s" : ""}
            </button>
          </div>
        </>
      )}
    </>
  );
}
