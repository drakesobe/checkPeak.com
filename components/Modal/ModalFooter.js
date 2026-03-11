"use client";

export default function ModalFooter({ affiliateLink }) {
  return (
    <div className="w-full flex justify-center">
      {affiliateLink && (
        <a
          href={affiliateLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full text-center bg-[#46769B] hover:bg-[#3b5c81] transition-colors text-white font-semibold px-4 py-2 rounded-lg shadow-md"
          onClick={() => {
            if (typeof window.gtag === "function") {
              window.gtag("event", "conversion", {
                send_to: "AW-17990566633/eJHlCOT724YcEOmFyYJD",
              });
            }
          }}
        >
          Get This Stack
        </a>
      )}
    </div>
  );
}