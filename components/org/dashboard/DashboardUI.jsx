// /components/org/dashboard/DashboardUI.jsx
"use client";

import { useState } from "react";
import { Copy, X, Tag, AlertTriangle, CheckCircle2 } from "lucide-react";
import { classNames } from "@/lib/org/dashboard-utils";

export function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1 break-words">
            {value}
          </p>
          {sub ? <p className="text-[11px] text-gray-500 mt-2">{sub}</p> : null}
        </div>
        <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-[#46769B]" />
        </div>
      </div>
    </div>
  );
}

export function Pill({ children, tone = "neutral" }) {
  const toneCls =
    tone === "warn"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-800 border-red-200"
      : tone === "good"
      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={classNames(
        "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border",
        toneCls
      )}
    >
      {children}
    </span>
  );
}

export function TagChip({ text }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border border-gray-200 bg-white text-gray-700">
      <Tag className="w-3.5 h-3.5 text-gray-400" />
      <span className="break-words">{text}</span>
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  className = "",
  title = "",
  type = "button",
}) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition";
  const styles =
    variant === "primary"
      ? "bg-[#46769B] text-white hover:brightness-110"
      : variant === "dark"
      ? "bg-gray-900 text-white hover:opacity-90"
      : "bg-white text-gray-800 border border-gray-200 hover:bg-gray-50";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={classNames(
        base,
        styles,
        disabled ? "opacity-70 cursor-not-allowed" : "",
        className
      )}
      type={type}
    >
      {children}
    </button>
  );
}

export function CopyButton({ text, label = "Copy", compact = false }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      variant="secondary"
      onClick={onCopy}
      disabled={!text}
      className={compact ? "px-3 py-2 text-xs" : ""}
    >
      <Copy className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      {copied ? "Copied" : label}
    </Button>
  );
}

export function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        role="button"
        tabIndex={0}
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200">
          <div className="p-5 border-b flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-lg font-extrabold text-gray-900 truncate">
                {title}
              </p>
              <p className="text-[12px] text-gray-500 mt-1">
                Update status/tags to power filtering and workflow.
              </p>
            </div>
            <button
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              onClick={onClose}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function PlanChip({ needsPlan, stale }) {
  if (needsPlan) {
    return (
      <Pill tone="bad">
        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
        Needs plan
      </Pill>
    );
  }
  if (stale) {
    return (
      <Pill tone="warn">
        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
        Needs update
      </Pill>
    );
  }
  return (
    <Pill tone="good">
      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
      Current
    </Pill>
  );
}
