"use client";

import { useEffect, useRef, useState } from "react";

export default function ProgressBar({ progress = 0 }) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const target = Math.max(0, Math.min(100, Number(progress) || 0));
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const animate = () => {
      setDisplayProgress((prev) => {
        const next = prev + (target - prev) * 0.12;
        if (Math.abs(target - next) < 0.2) return target;
        rafRef.current = requestAnimationFrame(animate);
        return next;
      });
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [progress]);

  return (
    <div className="w-full h-1 bg-gray-300 rounded-full mt-2 overflow-hidden">
      <div
        className="h-1 bg-blue-500 rounded-full transition-[width] duration-200 ease-out"
        style={{ width: `${displayProgress}%` }}
      />
    </div>
  );
}
