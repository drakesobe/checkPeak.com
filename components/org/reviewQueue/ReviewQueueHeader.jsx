// components/org/reviewQueue/ReviewQueueHeader.jsx
"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Copy,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Button, Pill } from "@/components/org/reviewQueue/ui";

/* ---------------- utils ---------------- */

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function safeText(v) {
  return String(v ?? "").trim();
}

function shortEmail(email) {
  const e = safeText(email);
  if (!e) return "";
  if (e.length <= 30) return e;
  const at = e.indexOf("@");
  if (at <= 2) return e.slice(0, 30) + "…";
  return e.slice(0, Math.min(at, 18)) + "…@" + e.slice(at + 1);
}

function shortToken(token) {
  const t = safeText(token);
  if (!t) return "";
  if (t.length <= 16) return t;
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

/* ---------------- subcomponents ---------------- */

function HeaderTitle({ title = "Review Queue" }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
        <ClipboardList className="w-5 h-5 text-[#46769B]" />
      </div>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 truncate leading-tight">{title}</h1>
      </div>
    </div>
  );
}

function OrgMeta({ orgName, orgEmail }) {
  const name = safeText(orgName) || "Organization";
  const email = safeText(orgEmail);

  return (
    <div className="mt-1.5 text-sm text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-semibold text-gray-900">{name}</span>
      <span className="text-gray-300">•</span>
      <span className="min-w-0" title={email || ""}>
        Logged in as <span className="font-semibold text-gray-900">{shortEmail(email) || "—"}</span>
      </span>
    </div>
  );
}

function PrimaryGuidance() {
  return (
    <div className="mt-2.5 flex items-start gap-2 text-sm text-gray-600">
      <Info className="w-4 h-4 mt-[2px] text-gray-400 shrink-0" />
      <p className="min-w-0 leading-relaxed">
        Review submissions: open an item, approve it, or request info so the athlete can re-submit.
      </p>
    </div>
  );
}

function Actions({ loading, onBack, onRefresh }) {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:justify-end">
      <Button variant="secondary" onClick={onBack} className="w-full sm:w-auto">
        <ArrowRight className="w-4 h-4 rotate-180" />
        Back
      </Button>

      <Button variant="secondary" onClick={onRefresh} disabled={loading} className="w-full sm:w-auto">
        <RefreshCcw className={cx("w-4 h-4", loading ? "animate-spin" : "")} />
        {loading ? "Refreshing…" : "Refresh"}
      </Button>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3 sm:p-4">
      <p className="text-sm text-gray-900 font-semibold">Loading review queue…</p>
      <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
        Pulling workouts with uploads that were submitted or re-submitted.
      </p>
    </div>
  );
}

function ErrorPanel({ error }) {
  return (
    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 sm:p-4">
      <p className="text-sm text-red-700 font-semibold">{safeText(error) || "Something went wrong."}</p>
      <p className="text-[11px] text-red-600 mt-1 leading-relaxed">
        If this persists, try Refresh. If it still fails, re-login.
      </p>
    </div>
  );
}

function SystemPanel({ orgToken, orgId, copied, onCopyToken }) {
  const hasToken = Boolean(safeText(orgToken));
  const hasOrgId = Boolean(safeText(orgId));

  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
      <div className="flex flex-wrap gap-2">
        <Pill tone="good">
          <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
          Session Active
        </Pill>

        {hasToken ? (
          <Pill tone="good">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Token Loaded
          </Pill>
        ) : (
          <Pill tone="bad">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Missing Token
          </Pill>
        )}

        {hasOrgId ? (
          <Pill tone="good">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
            orgId Loaded
          </Pill>
        ) : (
          <Pill tone="warn">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            orgId Missing
          </Pill>
        )}
      </div>

      {hasToken ? (
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="text-xs text-gray-600">
            Org token: <span className="font-semibold text-gray-900">{shortToken(orgToken)}</span>
          </div>

          <button
            type="button"
            onClick={onCopyToken}
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-[#46769B] hover:underline w-full sm:w-auto"
            title="Copy org token"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? "Copied" : "Copy token"}
          </button>
        </div>
      ) : (
        <div className="mt-3 text-xs text-gray-600 leading-relaxed">
          Token is missing — org-scoped requests may fail. If the queue looks empty unexpectedly, re-login.
        </div>
      )}
    </div>
  );
}

/* ---------------- main component ---------------- */

export default function ReviewQueueHeader({
  orgName,
  orgEmail,
  orgToken,
  orgId,
  headline,
  loading,
  error,
  onBack,
  onRefresh,
}) {
  const [copied, setCopied] = useState(false);
  const [systemOpen, setSystemOpen] = useState(false);

  const systemLabel = useMemo(() => {
    const missing = !safeText(orgToken) || !safeText(orgId);
    return missing ? "System (needs attention)" : "System";
  }, [orgToken, orgId]);

  const onCopyToken = useCallback(async () => {
    const t = safeText(orgToken);
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  }, [orgToken]);

  return (
    <header className="bg-white rounded-2xl shadow-md border border-blue-100 p-4 sm:p-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        {/* LEFT */}
        <div className="min-w-0">
          <HeaderTitle />

          <OrgMeta orgName={orgName} orgEmail={orgEmail} />

          <PrimaryGuidance />

          {/* System toggle: more breathing room + simpler default view */}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setSystemOpen((v) => !v)}
              className={cx(
                "w-full sm:w-auto inline-flex items-center justify-center gap-2",
                "px-3.5 py-2 rounded-2xl border text-sm font-semibold",
                "bg-white hover:bg-gray-50 transition",
                "border-gray-200 text-gray-800"
              )}
            >
              <span>{systemLabel}</span>
              {systemOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {systemOpen ? (
              <SystemPanel orgToken={orgToken} orgId={orgId} copied={copied} onCopyToken={onCopyToken} />
            ) : null}
          </div>
        </div>

        {/* RIGHT */}
        <Actions loading={loading} onBack={onBack} onRefresh={onRefresh} />
      </div>

      {/* State panels */}
      {loading ? <LoadingPanel /> : null}
      {error ? <ErrorPanel error={error} /> : null}
    </header>
  );
}
