// pages/finish-setup.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

export default function FinishSetupPage() {
  const router = useRouter();
  const invite = useMemo(() => String(router?.query?.invite || "").trim(), [router?.query?.invite]);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    setErr("");
    setOk("");
  }, [invite]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setOk("");

    if (!invite) {
      setErr("Missing invite token.");
      return;
    }
    if (!password || password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== password2) {
      setErr("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/org/members/finishSetup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken: invite, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to set password.");

      setOk("Password set! Redirecting to login…");
      setPassword("");
      setPassword2("");

      // send them home; they login via modal as Staff
      setTimeout(() => {
        router.push("/");
      }, 900);
    } catch (e2) {
      setErr(e2?.message || "Failed to set password.");
    } finally {
      setLoading(false);
    }
  };

  const inputBase =
    "w-full px-4 py-3 rounded-xl border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#46769B]";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md border border-blue-100 p-6">
        <h1 className="text-2xl font-extrabold text-gray-900">Finish setup</h1>
        <p className="text-sm text-gray-600 mt-1">
          Set your password to activate your staff account.
        </p>

        {!invite ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Invite link is missing.</p>
            <p className="text-[12px] text-amber-800 mt-1">
              Ask your organization admin to resend your invite.
            </p>
          </div>
        ) : (
          <>
            {err ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700 font-semibold">{err}</p>
              </div>
            ) : null}

            {ok ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <p className="text-sm text-emerald-800 font-semibold">{ok}</p>
              </div>
            ) : null}

            <form onSubmit={submit} className="mt-5 space-y-3">
              <div>
                <label className="text-xs text-gray-600 font-semibold">New password</label>
                <input
                  className={inputBase}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="text-xs text-gray-600 font-semibold">Confirm password</label>
                <input
                  className={inputBase}
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>

              <button
                className={classNames(
                  "w-full py-3 rounded-2xl text-white font-semibold",
                  loading ? "opacity-70 cursor-not-allowed" : "hover:brightness-110"
                )}
                style={{ backgroundColor: "#46769B" }}
                disabled={loading}
                type="submit"
              >
                {loading ? "Saving..." : "Set password"}
              </button>

              <p className="text-[11px] text-gray-500">
                After this, return to the home page and log in as <b>Staff</b>.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
