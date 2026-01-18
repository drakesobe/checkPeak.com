// components/Footer.jsx
import CookieSettings from "@/components/CookieSettings";

export default function Footer() {
  return (
    <footer className="w-full mt-16 border-t border-gray-800 bg-gradient-to-b from-gray-900 via-black to-gray-950 text-gray-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top CTA strip */}
        <div className="flex flex-col gap-3 py-6 border-b border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              Missing an ingredient in our database?
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Help keep CheckPeak accurate for athletes, coaches, and stack nerds.
            </p>
          </div>
          <a
            href="/add-ingredient"
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black shadow-sm transition hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
          >
            Suggest an Ingredient
          </a>
        </div>

        {/* Main footer content */}
        <div className="grid gap-10 py-10 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <p className="text-sm font-semibold tracking-wide text-white">CheckPeak</p>
            <p className="mt-2 text-xs text-gray-400 leading-relaxed">
              Scan smarter. Spot banned or risky ingredients before they land in your
              stack. Built for athletes, coaches, and anyone who takes what they put
              in their body seriously.
            </p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-gray-700/70 bg-gray-900/60 px-3 py-1 text-[11px] text-gray-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Transparency-first. No supplement brand affiliations.</span>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Product
            </h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <a
                  href="/nutrition-label-scanner"
                  className="transition-colors hover:text-white"
                >
                  Start a Scan
                </a>
              </li>
              <li>
                <a href="/faq" className="transition-colors hover:text-white">
                  FAQs
                </a>
              </li>
              <li>
                <a href="/info" className="transition-colors hover:text-white">
                  Info &amp; About
                </a>
              </li>
            </ul>

            {/* SEO internal link cluster */}
            <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Scanners
            </h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <a
                  href="/nutrition-label-scanner"
                  className="transition-colors hover:text-white"
                >
                  Nutrition Label Scanner
                </a>
              </li>
              <li>
                <a
                  href="/supplement-label-scanner"
                  className="transition-colors hover:text-white"
                >
                  Supplement Label Scanner
                </a>
              </li>
              <li>
                <a
                  href="/banned-substance-checker"
                  className="transition-colors hover:text-white"
                >
                  Banned Substance Checker
                </a>
              </li>
              <li>
                <a
                  href="/pre-workout-label-scanner"
                  className="transition-colors hover:text-white"
                >
                  Pre-Workout Label Scanner
                </a>
              </li>
              <li>
                <a
                  href="/protein-powder-label-scanner"
                  className="transition-colors hover:text-white"
                >
                  Protein Powder Label Scanner
                </a>
              </li>
            </ul>
          </div>

          {/* Support / Social */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Support &amp; Connect
            </h3>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <a href="/contact" className="transition-colors hover:text-white">
                  Contact
                </a>
              </li>
              <li>
                <a href="/add-ingredient" className="transition-colors hover:text-white">
                  Suggest an Ingredient
                </a>
              </li>
            </ul>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Social
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
                <a
                  href="https://www.instagram.com/peakverified/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-gray-700/80 px-2.5 py-1 transition hover:border-emerald-400 hover:text-white"
                >
                  <span aria-hidden="true">◎</span>
                  <span>Instagram</span>
                </a>
                <a
                  href="https://tiktok.com/@checkpeak"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-gray-700/80 px-2.5 py-1 transition hover:border-emerald-400 hover:text-white"
                >
                  <span aria-hidden="true">◎</span>
                  <span>TikTok</span>
                </a>
                <a
                  href="https://www.youtube.com/@checkpeak"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-gray-700/80 px-2.5 py-1 transition hover:border-emerald-400 hover:text-white"
                >
                  <span aria-hidden="true">◎</span>
                  <span>YouTube</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800/80 py-4">
          <div className="flex flex-col items-center justify-between gap-2 text-[11px] text-gray-500 sm:flex-row">
            <p>© {new Date().getFullYear()} CheckPeak. All rights reserved.</p>

            {/* Legal / prefs row */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
              <a href="/privacy" className="hover:text-white hover:underline">
                Privacy
              </a>
              <a href="/terms" className="hover:text-white hover:underline">
                Terms
              </a>

              {/* ✅ Cookie settings belongs here */}
              <CookieSettings />
            </div>
          </div>

          <div className="mt-2 text-center sm:text-left">
            <p className="text-[10px] text-gray-600">
              Designed for athletes — not supplement companies.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
