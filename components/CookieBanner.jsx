import { useEffect, useState } from "react";
import { getConsent, setConsent } from "@/lib/consent";

export default function CookieBanner({ onChange }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const c = getConsent();
    if (!c.decided) setOpen(true);
  }, []);

  if (!open) return null;

  const accept = () => {
    setConsent({ analytics: true });
    onChange?.({ analytics: true, decided: true });
    setOpen(false);
  };

  const decline = () => {
    setConsent({ analytics: false });
    onChange?.({ analytics: false, decided: true });
    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-3xl rounded-3xl border border-blue-100 bg-white p-4 shadow-xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">Cookies & analytics</p>
          <p className="text-xs text-gray-600 mt-1">
            We use analytics to improve CheckPeak and show you your activity insights. No selling of data.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 rounded-2xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 rounded-2xl bg-[#46769B] text-white font-semibold hover:brightness-110"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
