// components/AnimatedEllipsis.js
import { useState, useEffect } from "react";

export default function AnimatedEllipsis({ text = "Analyzing ingredients" }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length < 3 ? prev + "." : ""));
    }, 500); // change every 500ms

    return () => clearInterval(interval);
  }, []);

  return (
    <span>
      {text}
      {dots}
    </span>
  );
}
