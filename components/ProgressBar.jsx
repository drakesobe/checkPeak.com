// components/ProgressBar.jsx
"use client";

import { useEffect, useRef, useState } from "react";

export default function ProgressBar({ progress = 0, scanning = false }) {
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
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [progress]);

  return (
    <div
      style={{
        width: "100%",
        height: 3,
        background: "#E2E8F0",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${displayProgress}%`,
          background: "linear-gradient(90deg, #4FABFF, #0284C7)",
          transition: "width 0.2s ease-out",
          position: "relative",
        }}
      >
        {/* Shimmer on active scan */}
        {scanning && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
            animation: "pb-shimmer 1.2s ease-in-out infinite",
          }} />
        )}
      </div>
      <style>{`@keyframes pb-shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }`}</style>
    </div>
  );
}