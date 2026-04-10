// components/Footer.jsx
import CookieSettings from "@/components/CookieSettings";

/* -------------------------------------------------------------------------- */
/* Social SVG icons                                                            */
/* -------------------------------------------------------------------------- */

function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconTikTok() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.17 8.17 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z"/>
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 00.5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 002.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 002.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.5v-7l6.5 3.5-6.5 3.5z"/>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* StatPill — a single trust metric                                           */
/* -------------------------------------------------------------------------- */
function StatPill({ value, label }) {
  return (
    <div
      className="flex flex-col items-start px-3.5 py-2.5 rounded-xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border:     "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <span
        className="text-lg font-black text-white leading-none"
        style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.02em" }}
      >
        {value}
      </span>
      <span
        className="mt-0.5 text-[10px] uppercase tracking-widest leading-tight"
        style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Barlow Condensed', sans-serif" }}
      >
        {label}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* NavLink                                                                     */
/* -------------------------------------------------------------------------- */
function NavLink({ href, children, arrow = false }) {
  return (
    <li>
      <a
        href={href}
        className="inline-flex items-center gap-1.5 text-xs transition-all group"
        style={{ color: "rgba(255,255,255,0.65)" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
      >
        {arrow && (
          <span
            aria-hidden="true"
            className="text-[9px] transition-transform group-hover:translate-x-0.5"
            style={{ color: "rgba(91,158,201,0.7)" }}
          >
            ›
          </span>
        )}
        {children}
      </a>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                      */
/* -------------------------------------------------------------------------- */
export default function Footer() {
  return (
    <footer
      className="w-full mt-16 relative"
      style={{
        background: "#0A0C10",
        fontFamily: "'Barlow', sans-serif",
        color:      "rgba(255,255,255,0.55)",
      }}
    >
      {/* Top accent line — thin blue glow at the seam */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(91,158,201,0.4) 30%, rgba(91,158,201,0.6) 50%, rgba(91,158,201,0.4) 70%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0"
        style={{
          height:  "60px",
          background: "linear-gradient(to bottom, rgba(91,158,201,0.04) 0%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* ── Brand hero block ────────────────────────────────────────────── */}
        {/*
          Full-width brand statement above the nav grid.
          This is the product's last impression — it should earn it.
        */}
        <div
          className="pt-12 pb-8"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

            {/* Left: wordmark + mission */}
            <div className="max-w-lg">
              {/* Wordmark with live dot — mirrors the SmartStack badge pattern */}
              <div className="flex items-center gap-2.5 mb-3">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: "#5B9EC9", boxShadow: "0 0 8px rgba(91,158,201,0.6)" }}
                  aria-hidden="true"
                />
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: "rgba(91,158,201,0.8)", fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  CheckPeak
                </span>
              </div>

              <h2
                className="text-2xl sm:text-3xl font-black text-white leading-tight"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.02em" }}
              >
                Designed for athletes.<br />
                <span style={{ color: "rgba(255,255,255,0.6)" }}>Not supplement companies.</span>
              </h2>

              <p
                className="mt-3 text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.65)", maxWidth: "42ch" }}
              >
                Scan smarter. Spot banned or risky ingredients before they land in
                your stack. Built for athletes, coaches, and anyone who takes what
                they put in their body seriously.
              </p>
            </div>

            {/* Right: trust stats — concrete proof, not just claims */}
            <div className="flex flex-wrap gap-2.5 lg:shrink-0">
              <StatPill value="1,000+"  label="Ingredients tracked"     />
              <StatPill value="900+"     label="Banned substances"       />
              <StatPill value="10,000+" label="Scans completed"         />
              <StatPill value="0"       label="Brand affiliations"      />
            </div>
          </div>
        </div>

        {/* ── Nav grid ────────────────────────────────────────────────────── */}
        <div className="grid gap-8 py-10 sm:grid-cols-2 md:grid-cols-4">

          {/* Product */}
          <div>
            <h3
              className="text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: "rgba(255,255,255,0.38)", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Product
            </h3>
            <ul className="space-y-2.5">
              <NavLink href="/nutrition-label-scanner" arrow>Start a Scan</NavLink>
              <NavLink href="/smartstack-compare"      arrow>SmartStack</NavLink>
              <NavLink href="/faq"                     arrow>FAQs</NavLink>
              <NavLink href="/info"                    arrow>Info &amp; About</NavLink>
            </ul>
          </div>

          {/* Scanners */}
          <div>
            <h3
              className="text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: "rgba(255,255,255,0.38)", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Scanners
            </h3>
            <ul className="space-y-2.5">
              <NavLink href="/nutrition-label-scanner"      arrow>Nutrition Label</NavLink>
              <NavLink href="/supplement-label-scanner"     arrow>Supplement Label</NavLink>
              <NavLink href="/banned-substance-checker"     arrow>Banned Substances</NavLink>
              <NavLink href="/pre-workout-label-scanner"    arrow>Pre-Workout</NavLink>
              <NavLink href="/protein-powder-label-scanner" arrow>Protein Powder</NavLink>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3
              className="text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: "rgba(255,255,255,0.38)", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Support
            </h3>
            <ul className="space-y-2.5">
              <NavLink href="/contact"        arrow>Contact</NavLink>
              <NavLink href="/add-ingredient" arrow>Suggest an Ingredient</NavLink>
            </ul>

            {/* CTA — lives in the support column, contextually makes sense */}
            <div
              className="mt-5 rounded-xl p-3"
              style={{
                background: "rgba(91,158,201,0.06)",
                border:     "1px solid rgba(91,158,201,0.16)",
              }}
            >
              <p
                className="text-xs font-bold text-white leading-snug"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Missing an ingredient?
              </p>
              <p
                className="mt-0.5 text-[11px] leading-relaxed"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                Help keep the database accurate for every athlete.
              </p>
              <a
                href="/add-ingredient"
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all"
                style={{
                  background:    "rgba(91,158,201,0.15)",
                  border:        "1px solid rgba(91,158,201,0.3)",
                  color:         "#5B9EC9",
                  fontFamily:    "'Barlow Condensed', sans-serif",
                  letterSpacing: "0.04em",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background  = "rgba(91,158,201,0.25)";
                  e.currentTarget.style.borderColor = "rgba(91,158,201,0.5)";
                  e.currentTarget.style.color       = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background  = "rgba(91,158,201,0.15)";
                  e.currentTarget.style.borderColor = "rgba(91,158,201,0.3)";
                  e.currentTarget.style.color       = "#5B9EC9";
                }}
              >
                Suggest →
              </a>
            </div>
          </div>

          {/* Social */}
          <div>
            <h3
              className="text-[10px] font-bold uppercase tracking-widest mb-3"
              style={{ color: "rgba(255,255,255,0.38)", fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              Follow Along
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { href: "https://www.instagram.com/peakverified/", label: "Instagram", handle: "@peakverified", Icon: IconInstagram },
                { href: "https://tiktok.com/@checkpeak",           label: "TikTok",    handle: "@checkpeak",   Icon: IconTikTok    },
                { href: "https://www.youtube.com/@checkpeak",      label: "YouTube",   handle: "@checkpeak",   Icon: IconYouTube   },
              ].map(({ href, label, handle, Icon }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all group"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border:     "1px solid rgba(255,255,255,0.07)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background  = "rgba(91,158,201,0.08)";
                    e.currentTarget.style.borderColor = "rgba(91,158,201,0.25)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background  = "rgba(255,255,255,0.03)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                  }}
                >
                  {/* Icon box */}
                  <div
                    className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border:     "1px solid rgba(255,255,255,0.08)",
                      color:      "rgba(255,255,255,0.6)",
                    }}
                  >
                    <Icon />
                  </div>
                  {/* Label + handle stacked */}
                  <div className="min-w-0">
                    <p
                      className="text-xs font-semibold text-white leading-none"
                    >
                      {label}
                    </p>
                    <p
                      className="mt-0.5 text-[10px] leading-none truncate"
                      style={{ color: "rgba(255,255,255,0.5)" }}
                    >
                      {handle}
                    </p>
                  </div>
                  {/* Hover arrow */}
                  <span
                    className="ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: "rgba(91,158,201,0.7)" }}
                    aria-hidden="true"
                  >
                    ↗
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Bottom bar ────────────────────────────────────────────────── */}
        <div
          className="py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
            © {new Date().getFullYear()} CheckPeak. All rights reserved.
          </p>

          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            <a
              href="/privacy"
              className="transition-colors"
              onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
            >
              Privacy
            </a>
            <a
              href="/terms"
              className="transition-colors"
              onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
            >
              Terms
            </a>
            <CookieSettings />
          </div>
        </div>

      </div>
    </footer>
  );
}