// pages/setup/trainer.js

import { useMemo, useState } from "react";
import { useRouter } from "next/router";

/**
 * ✅ IMPORTANT:
 * This page must NOT be statically prerendered.
 * Using getServerSideProps forces SSR and avoids Vercel "prerender" failures.
 */
export async function getServerSideProps(ctx) {
  const { query, res } = ctx || {};
  const tokenRaw = query?.token;

  // Guard: during SSR, res should exist. This is safe even if it doesn't.
  try {
    res?.setHeader?.("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res?.setHeader?.("Pragma", "no-cache");
    res?.setHeader?.("Expires", "0");
  } catch {
    // ignore
  }

  const token = Array.isArray(tokenRaw)
    ? String(tokenRaw[0] || "").trim()
    : String(tokenRaw || "").trim();

  return {
    props: {
      token: token || "",
    },
  };
}

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function TrainerSetupPage({ token = "" }) {
  const router = useRouter();

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  const tokenPresent = useMemo(() => Boolean(String(token || "").trim()), [token]);

  const canSubmit = useMemo(() => {
    if (!tokenPresent) return false;
    if (busy) return false;
    if (!pw1 || pw1.length < 8) return false;
    if (pw1 !== pw2) return false;
    return true;
  }, [tokenPresent, busy, pw1, pw2]);

  const onSubmit = async () => {
    setErr("");
    setOk("");

    if (!tokenPresent) {
      setErr("Missing token. Please open this page from your invite link.");
      return;
    }
    if (!pw1 || pw1.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (pw1 !== pw2) {
      setErr("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/org/members/finishSetup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          inviteToken: token,
          password: pw1,
        }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.error || "Failed to set password.");

      setOk(data?.message || "Password set! Redirecting to login…");

      setTimeout(() => {
        // change this if your login route is different
        router.push("/");
      }, 1200);
    } catch (e) {
      setErr(e?.message || "Failed to set password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 text-gray-900 font-sans">
      <main className="max-w-xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-md border border-blue-100 p-6">
          <h1 className="text-2xl font-extrabold">Finish trainer setup</h1>
          <p className="text-sm text-gray-600 mt-1">Set your password to activate access.</p>

          {!tokenPresent ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Missing setup token</p>
              <p className="text-[11px] text-amber-800 mt-1">
                Open this page using the invite link (it should include{" "}
                <span className="font-mono">?token=...</span>).
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">Invite token detected</p>
              <p className="text-[11px] text-gray-600 mt-1">You can proceed.</p>
            </div>
          )}

          {err ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">{err}</p>
            </div>
          ) : null}

          {ok ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">{ok}</p>
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <div>
              <label className="text-xs text-gray-600 font-semibold">New password</label>
              <input
                className={classNames(inputBase, "mt-2")}
                type="password"
                value={pw1}
                onChange={(e) => setPw1(e.target.value)}
                placeholder="At least 8 characters"
                disabled={busy}
              />
            </div>

            <div>
              <label className="text-xs text-gray-600 font-semibold">Confirm password</label>
              <input
                className={classNames(inputBase, "mt-2")}
                type="password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="Re-enter password"
                disabled={busy}
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit}
                className={classNames(
                  "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition",
                  "bg-[#46769B] text-white hover:brightness-110",
                  !canSubmit ? "opacity-60 cursor-not-allowed" : ""
                )}
              >
                {busy ? "Saving…" : "Finish setup"}
              </button>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed">
              After setup, you’ll be redirected to login.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
