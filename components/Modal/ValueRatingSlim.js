"use client";

import React from "react";

/**
 * Slim star rating for CompareCard
 * @param {object} props
 * @param {number} props.value 0-5 rating
 */
export default function ValueRatingSlim({ value = 0 }) {
  const filledStars = Math.floor(value);
  const halfStar = value - filledStars >= 0.5;
  const emptyStars = 5 - filledStars - (halfStar ? 1 : 0);

  return (
    <div className="flex items-center text-yellow-400 text-xs">
      {/* Filled stars */}
      {Array.from({ length: filledStars }).map((_, i) => (
        <svg
          key={`filled-${i}`}
          className="w-3 h-3"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.954L10 0l2.951 5.956 6.561.954-4.756 4.635 1.122 6.545z" />
        </svg>
      ))}

      {/* Half star */}
      {halfStar && (
        <svg
          className="w-3 h-3"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <defs>
            <linearGradient id="halfGrad">
              <stop offset="50%" stopColor="currentColor" />
              <stop offset="50%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path
            fill="url(#halfGrad)"
            d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.954L10 0l2.951 5.956 6.561.954-4.756 4.635 1.122 6.545z"
          />
        </svg>
      )}

      {/* Empty stars */}
      {Array.from({ length: emptyStars }).map((_, i) => (
        <svg
          key={`empty-${i}`}
          className="w-3 h-3 text-gray-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.954L10 0l2.951 5.956 6.561.954-4.756 4.635 1.122 6.545z" />
        </svg>
      ))}
    </div>
  );
}
