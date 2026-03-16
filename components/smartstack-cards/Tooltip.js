"use client";

export default function Tooltip({ content, children }) {
  return (
    <div className="relative group inline-flex">
      {children}
      <div
        className="absolute top-full left-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50"
        style={{ marginTop: 4 }}
      >
        <div
          style={{
            background:    "rgba(15,20,28,0.96)",
            border:        "1px solid rgba(255,255,255,0.1)",
            borderRadius:  6,
            padding:       "4px 8px",
            fontSize:      10,
            fontFamily:    "'Barlow Condensed', sans-serif",
            fontWeight:    500,
            letterSpacing: "0.02em",
            color:         "rgba(255,255,255,0.75)",
            whiteSpace:    "normal",
            maxWidth:      160,
            lineHeight:    1.4,
            backdropFilter:"blur(6px)",
          }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}