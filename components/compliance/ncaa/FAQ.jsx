// components/compliance/ncaa/FAQ.jsx
"use client";

import { useMemo, useState } from "react";

function Item({ q, a, open, onToggle }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-3"
      >
        <span className="font-semibold text-gray-900">{q}</span>
        <span className="text-gray-400">{open ? "–" : "+"}</span>
      </button>
      {open ? (
        <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">
          {a}
        </div>
      ) : null}
    </div>
  );
}

export default function FAQ() {
  const faqs = useMemo(
    () => [
      {
        q: "Does CheckPeak determine eligibility or compliance outcomes?",
        a:
          "No. CheckPeak supports education, documentation, and escalation. " +
          "Your compliance office and athletics health care staff should make final determinations.",
      },
      {
        q: "Does CheckPeak have an “approved supplements” list?",
        a:
          "No. CheckPeak avoids presenting supplements as “approved.” We focus on risk-awareness and program-defined workflows.",
      },
      {
        q: "How should athletes use CheckPeak responsibly?",
        a:
          "Use it to understand risk signals, document what you’re considering/taking, and escalate to staff when something is flagged or uncertain.",
      },
      {
        q: "What should an athletics department do to implement this well?",
        a:
          "Define your internal policy (what’s allowed to log, what triggers escalation, who reviews, how you educate), then align CheckPeak settings and messaging to that policy.",
      },
    ],
    []
  );

  const [openIdx, setOpenIdx] = useState(0);

  return (
    <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
      <h2 className="text-xl font-bold text-gray-900">FAQ</h2>
      <div className="grid gap-3 mt-4">
        {faqs.map((f, idx) => (
          <Item
            key={f.q}
            q={f.q}
            a={f.a}
            open={openIdx === idx}
            onToggle={() => setOpenIdx((v) => (v === idx ? -1 : idx))}
          />
        ))}
      </div>
    </section>
  );
}