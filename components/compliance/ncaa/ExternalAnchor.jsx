// components/compliance/ncaa/ExternalAnchor.jsx
"use client";

export default function ExternalAnchor({ href, children, className = "" }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={[
        "inline-flex items-center gap-1 text-[#46769B] hover:underline",
        className,
      ].join(" ")}
    >
      {children}
      <span aria-hidden className="text-[12px]">↗</span>
    </a>
  );
}