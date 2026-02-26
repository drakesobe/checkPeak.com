"use client";

export default function SectionHeader({ kicker, title, subtitle }) {
  return (
    <div className="text-center max-w-3xl mx-auto">
      {kicker ? (
        <p className="text-xs font-extrabold tracking-widest text-[#46769B] uppercase">
          {kicker}
        </p>
      ) : null}
      <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">{title}</h2>
      {subtitle ? (
        <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">{subtitle}</p>
      ) : null}
    </div>
  );
}