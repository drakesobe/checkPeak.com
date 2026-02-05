"use client";

import { useEffect, useRef, useState } from "react";

export default function AnimatedEllipsis({
  text = "Analyzing ingredients",
  maxDots = 3,
  intervalMs = 500,
}) {
  const [dots, setDots] = useState("");
  const intervalRef = useRef(null);

  useEffect(() => {
    // Clear any existing interval (safety for React strict mode)
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setDots((prev) => (prev.length < maxDots ? prev + "." : ""));
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [maxDots, intervalMs]);

  return (
    <span className="inline-flex items-center whitespace-nowrap">
      <span>{text}</span>
      <span className="w-[1.25em] text-left">{dots}</span>
    </span>
  );
}
