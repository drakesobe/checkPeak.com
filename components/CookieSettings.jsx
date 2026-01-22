// components/CookieSettings.jsx
import { useEffect, useState } from "react";
import { getConsent, setConsent } from "@/lib/consent";
import { motion, AnimatePresence } from "framer-motion";

export default function CookieSettings({ onChange }) {
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    const c = getConsent();
    setAnalytics(!!c.analytics);
  }, []);

  const save = () => {
    setConsent({ analytics });
    onChange?.({ analytics, decided: true });
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-gray-500 hover:text-gray-700 hover:underline"
      >
        Cookie settings
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="w-full max-w-md rounded-3xl bg-white border border-blue-100 shadow-xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-[#46769B]">PRIVACY</p>
                  <h2 className="text-lg font-extrabold text-gray-900 mt-1">
                    Cookie settings
                  </h2>
                  <p className="text-[12px] text-gray-600 mt-1">
                    Control optional analytics. Essential cookies are always on.
                  </p>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  className="h-9 w-9 rounded-2xl border border-gray-200 grid place-items-center text-gray-600 hover:bg-gray-50 transition"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Analytics</p>
                      <p className="text-[12px] text-gray-600 mt-1">
                        Helps us understand usage and improve 
                        user experience. We do not sell your data.
                      </p>
                    </div>

                    <label className="inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={analytics}
                        onChange={(e) => setAnalytics(e.target.checked)}
                      />
                      <span
                        className={[
                          "w-11 h-6 rounded-full transition relative",
                          analytics ? "bg-[#46769B]" : "bg-gray-300",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                            analytics ? "left-5" : "left-0.5",
                          ].join(" ")}
                        />
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-4 py-2 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={save}
                    className="px-4 py-2 rounded-2xl bg-[#46769B] text-white font-semibold hover:brightness-110 transition"
                  >
                    Save
                  </button>
                </div>

                <p className="text-[11px] text-gray-500">
                  Tip: You can update this anytime from the footer.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
