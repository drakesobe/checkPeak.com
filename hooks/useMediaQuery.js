// hooks/useMediaQuery.js
import { useEffect, useState } from "react";

/**
 * useMediaQuery
 * - Returns true/false based on a CSS media query
 * - Safe for SSR (defaults false until mounted)
 */
export default function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const m = window.matchMedia(query);

    const onChange = () => setMatches(!!m.matches);

    // Set initial value
    onChange();

    // Subscribe
    if (typeof m.addEventListener === "function") {
      m.addEventListener("change", onChange);
      return () => m.removeEventListener("change", onChange);
    }

    // Safari fallback
    m.addListener(onChange);
    return () => m.removeListener(onChange);
  }, [query]);

  return matches;
}