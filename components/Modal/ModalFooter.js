"use client";

export default function ModalFooter({ affiliateLink, runOCR }) {
  const handleAmazon = () => {
    if (typeof window.gtag === "function") {
      window.gtag("event", "conversion", {
        send_to: "AW-17990566633/eJHlCOT724YcEOmFyYJD",
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Primary - Amazon, matches card button label exactly */}
      {affiliateLink ? (
        <a
          href={affiliateLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleAmazon}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all"
          style={{
            background:     "rgba(255,255,255,0.06)",
            border:         "1px solid rgba(255,255,255,0.12)",
            color:          "rgba(255,255,255,0.7)",
            fontFamily:     "'Barlow Condensed', sans-serif",
            letterSpacing:  "0.06em",
            textTransform:  "uppercase",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background  = "rgba(255,255,255,0.1)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)";
            e.currentTarget.style.color       = "rgba(255,255,255,0.92)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background  = "rgba(255,255,255,0.06)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            e.currentTarget.style.color       = "rgba(255,255,255,0.7)";
          }}
        >
          <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, flexShrink: 0 }} fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          View on Amazon
        </a>
      ) : (
        <div
          className="flex-1 rounded-xl py-2.5 text-center text-xs"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.18)" }}
        >
          Link unavailable
        </div>
      )}

      {/* Secondary - Re-scan, quiet */}
      {typeof runOCR === "function" && (
        <button
          type="button"
          onClick={() => runOCR(true)}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all"
          style={{
            background:    "rgba(255,255,255,0.04)",
            border:        "1px solid rgba(255,255,255,0.08)",
            color:         "rgba(255,255,255,0.4)",
            fontFamily:    "'Barlow Condensed', sans-serif",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.75)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.4)";  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
          aria-label="Re-scan label"
        >
          <svg viewBox="0 0 24 24" style={{ width: 11, height: 11 }} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V6a2 2 0 012-2h3M15 4h3a2 2 0 012 2v3M21 15v3a2 2 0 01-2 2h-3M9 20H6a2 2 0 01-2-2v-3" />
          </svg>
          Re-scan
        </button>
      )}
    </div>
  );
}