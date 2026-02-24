// /components/org/nutrition/profile/StaffActionsCard.jsx
"use client";

import { useMemo, useState } from "react";
import { Mail, Check, Copy } from "lucide-react";

function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

function fmtIsoToNice(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  } catch {
    return String(iso);
  }
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function TonePill({ tone = "neutral", text }) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 border-emerald-200"
      : tone === "warn"
      ? "bg-amber-50 text-amber-900 border-amber-200"
      : tone === "bad"
      ? "bg-red-50 text-red-900 border-red-200"
      : "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        "text-[11px] font-semibold leading-none whitespace-nowrap",
        cls
      )}
    >
      {text}
    </span>
  );
}

function Notice({ tone = "warn", title, children }) {
  const shell =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50"
      : "border-red-200 bg-red-50";

  const titleCls =
    tone === "ok" ? "text-emerald-900" : tone === "warn" ? "text-amber-900" : "text-red-900";

  const bodyCls =
    tone === "ok" ? "text-emerald-900/90" : tone === "warn" ? "text-amber-900/90" : "text-red-900/90";

  return (
    <div className={cx("mt-4 rounded-2xl border p-4", shell)}>
      <p className={cx("text-sm font-extrabold", titleCls)}>{title}</p>
      <div className={cx("mt-1 text-sm", bodyCls)}>{children}</div>
    </div>
  );
}

function buildMailto({ email, name, missedThisWeek, lastCheckinAt }) {
  const to = String(email || "").trim();
  if (!to) return "";

  const subject = missedThisWeek ? "Quick nutrition completion check-in" : "Nutrition — quick update";
  const last = lastCheckinAt ? fmtIsoToNice(lastCheckinAt) : "—";

  const body = missedThisWeek
    ? `Hey ${name || ""},\n\nQuick nudge — I’m not seeing a recent nutrition completion.\n\nLast completion: ${last}\n\nWhen you get a chance, please knock out your Meal + Hydration swipes for today.\n\nThanks!`
    : `Hey ${name || ""},\n\nNice work staying consistent — your completions look current.\n\nLast completion: ${last}\n\nIf anything feels hard to follow in the dining hall, reply with what’s tripping you up and I’ll simplify the rule.\n\nThanks!`;

  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function StaffActionsCard({
  loading,
  error,
  missedThisWeek,
  lastCheckinAt,
  daysAgo,

  // for emailing
  athleteName,
  athleteEmail,

  // optional signal
  latestAvg,
}) {
  const show = !loading && !error;
  if (!show) return null;

  const avg = useMemo(() => clampPct(latestAvg), [latestAvg]);
  const adherenceTone = avg == null ? "neutral" : avg >= 80 ? "ok" : avg >= 60 ? "warn" : "bad";

  const daysAgoNice = useMemo(() => {
    if (daysAgo == null) return "";
    return `${Math.round(daysAgo)}d`;
  }, [daysAgo]);

  const mailto = useMemo(
    () =>
      buildMailto({
        email: athleteEmail,
        name: athleteName,
        missedThisWeek,
        lastCheckinAt,
      }),
    [athleteEmail, athleteName, missedThisWeek, lastCheckinAt]
  );

  const [copiedEmail, setCopiedEmail] = useState(false);

  const copyEmail = async () => {
    if (!athleteEmail) return;
    try {
      await navigator.clipboard.writeText(String(athleteEmail).trim());
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <section
      className={cx(
        "rounded-3xl border border-blue-100/70 bg-white/80 backdrop-blur-xl",
        "shadow-[0_10px_30px_-18px_rgba(30,58,138,0.35)]"
      )}
    >
      <div className="p-5">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-extrabold text-gray-900">Staff</p>

              <TonePill tone={adherenceTone} text={avg == null ? "Adherence —" : `Adherence ${avg}%`} />
              <TonePill tone={!missedThisWeek ? "ok" : "warn"} text={!missedThisWeek ? "Current" : "Missing/Old"} />
            </div>

            <p className="mt-1 text-xs text-gray-500">
              Quick nudge if needed, or use the email button to reach out directly.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={mailto || "#"}
              onClick={(e) => {
                if (!mailto) e.preventDefault();
              }}
              className={cx(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition",
                mailto
                  ? "border-gray-200 bg-white text-gray-900 hover:bg-gray-50 focus:ring-gray-200"
                  : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed",
                "focus:outline-none focus:ring-2"
              )}
              title={mailto ? "Email athlete" : "No athlete email on file"}
              aria-disabled={!mailto}
            >
              <Mail className="h-4 w-4" />
              Email athlete
            </a>

            {athleteEmail ? (
              <button
                type="button"
                onClick={copyEmail}
                className={cx(
                  "inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition",
                  "border-gray-200 bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                )}
                title="Copy athlete email"
              >
                {copiedEmail ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span className="hidden sm:inline">{copiedEmail ? "Copied" : "Copy email"}</span>
                <span className="sm:hidden">{copiedEmail ? "Copied" : "Copy"}</span>
              </button>
            ) : null}
          </div>
        </div>

        {missedThisWeek ? (
          <Notice tone="warn" title="Completion missing or outdated">
            <p>
              Last: <span className="font-semibold">{lastCheckinAt ? fmtIsoToNice(lastCheckinAt) : "None yet"}</span>
              {daysAgoNice ? <span className="text-amber-900/60"> • {daysAgoNice}</span> : null}
            </p>
          </Notice>
        ) : (
          <Notice tone="ok" title="Completion current">
            <p>
              Last: <span className="font-semibold">{lastCheckinAt ? fmtIsoToNice(lastCheckinAt) : "—"}</span>
            </p>
          </Notice>
        )}

        <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-blue-100 to-transparent" />
      </div>
    </section>
  );
}