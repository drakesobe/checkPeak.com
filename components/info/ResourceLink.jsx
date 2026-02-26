"use client";

import { FaExternalLinkAlt } from "react-icons/fa";

export default function ResourceLink({ name, desc, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm hover:shadow-md transition-transform hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-extrabold text-slate-900">{name}</p>
            <FaExternalLinkAlt className="text-slate-400 group-hover:text-slate-600 text-xs" />
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">{desc}</p>
        </div>
      </div>
    </a>
  );
}