// pages/commercial/dashboard.jsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import VideoLibrary from "@/components/commercial/VideoLibrary";
import AnalyticsTab  from "@/components/commercial/AnalyticsTab";
import Head from "next/head";
import { ArrowLeft, RefreshCcw, Users, Video, ExternalLink, X, Plus, Mail, Search, TrendingUp, CalendarDays, Salad, RefreshCw } from "lucide-react";
import { DS } from "@/components/org/dashboard/DashboardUI";

const TABS = ["Library", "Clients", "Pricing", "Analytics", "Settings"];

const DEFAULT_PERKS = {
  Basic:   ["Full video library access", "Filter by workout type & difficulty", "Watch on any device"],
  Premium: ["Everything in Basic", "Custom workouts built by your trainer", "Workout calendar assignments"],
  Ultra:   ["Everything in Premium", "In-person training sessions", "Direct trainer access"],
};

function parsePerks(raw, tier) {
  try { return JSON.parse(raw || "null") || DEFAULT_PERKS[tier]; }
  catch { return DEFAULT_PERKS[tier]; }
}

const TIER_STYLE = {
  Basic:   { bg: DS.safeBg,    color: DS.safe,    border: DS.safeBorder    },
  Premium: { bg: DS.cautionBg, color: DS.caution, border: DS.cautionBorder },
  Ultra:   { bg: DS.brandBg,   color: DS.brand,   border: DS.brandBorder   },
};

// ─── Top bar ──────────────────────────────────────────────────────────────────

function TopBar({ trainerName, router }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-4" style={{ backgroundColor: DS.brand }}>
      <div className="flex items-center gap-3 min-w-0">
        <button type="button" onClick={() => router.push("/org/workouts-calendar")}
          className="flex items-center gap-1.5 text-xs font-bold transition shrink-0"
          style={{ color: "rgba(255,255,255,0.55)" }}
          onMouseEnter={e => { e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}>
          <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
        </button>
        <div className="w-px h-4 shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
        <span className="font-black uppercase tracking-wider text-xs"
          style={{ color: "rgba(255,255,255,0.9)", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.08em" }}>
          Commercial
        </span>
        {trainerName && (
          <span className="text-xs truncate hidden sm:inline" style={{ color: "rgba(255,255,255,0.35)" }}>
            · {trainerName}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function TrainerHero({ trainer, videoCount, clientCount, tierBreakdown, onTabChange }) {
  const f = trainer.fields ?? {};

  const bp  = Number(f.basicPrice)   || 0;
  const pp  = Number(f.premiumPrice) || 0;
  const up  = Number(f.ultraPrice)   || 0;
  const mrr = tierBreakdown.Basic * bp + tierBreakdown.Premium * pp + tierBreakdown.Ultra * up;

  const tierPips = [
    tierBreakdown.Basic   > 0 && { label: "Basic",   count: tierBreakdown.Basic,   color: DS.safe    },
    tierBreakdown.Premium > 0 && { label: "Premium", count: tierBreakdown.Premium, color: DS.caution },
    tierBreakdown.Ultra   > 0 && { label: "Ultra",   count: tierBreakdown.Ultra,   color: DS.brand   },
  ].filter(Boolean);

  return (
    <div className="rounded-sm overflow-hidden mb-4"
      style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}` }}>
      <div className="flex items-center justify-between gap-4 flex-wrap px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest mb-1"
            style={{ color: DS.brand, letterSpacing: "0.1em" }}>
            Commercial Dashboard
          </p>
          <h1 className="font-black truncate"
            style={{ color: DS.bodyText, fontSize: "1.35rem", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "-0.01em" }}>
            {f.name}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: DS.labelText }}>{f.specialty}</p>
        </div>

        <div className="flex items-center gap-5 shrink-0 flex-wrap">
          {/* Videos */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Video className="w-3.5 h-3.5" style={{ color: DS.brand }} />
              <span className="text-xl font-black tabular-nums" style={{ color: DS.bodyText }}>{videoCount ?? 0}</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.dimText }}>Videos</p>
          </div>

          {/* Clients */}
          <div className="text-center">
            <button type="button" onClick={() => onTabChange("Clients")}
              className="flex items-center justify-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5" style={{ color: DS.brand }} />
              <span className="text-xl font-black tabular-nums" style={{ color: DS.bodyText }}>{clientCount}</span>
            </button>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.dimText }}>Clients</p>
          </div>

          {/* Est. MRR */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: DS.brand }} />
              <span className="text-xl font-black tabular-nums" style={{ color: DS.bodyText }}>
                {mrr > 0 ? `$${mrr.toLocaleString()}` : "—"}
              </span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: DS.dimText }}>Est. MRR</p>
          </div>

          <div className="w-px h-8" style={{ backgroundColor: DS.border }} />
          <a href={`/trainer/${f.slug}`} target="_blank" rel="noopener"
            className="flex items-center gap-1.5 px-3 py-2 rounded-sm text-xs font-bold transition"
            style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = DS.brandBorder; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = DS.brandBg; }}>
            <ExternalLink className="w-3 h-3" /> Profile
          </a>
        </div>
      </div>

      {/* Tier breakdown — bottom bar, only when there are tiered clients */}
      {tierPips.length > 0 && (
        <div className="flex items-center gap-3 px-5 py-2 border-t"
          style={{ borderColor: DS.border, backgroundColor: DS.pageBg }}>
          <span className="text-[9px] font-black uppercase tracking-widest shrink-0"
            style={{ color: DS.dimText }}>
            Breakdown
          </span>
          {tierPips.map(p => (
            <span key={p.label} className="text-[10px] font-black px-2 py-0.5 rounded-sm"
              style={{ color: p.color, backgroundColor: p.color + "18" }}>
              {p.count} {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pricing Tab ──────────────────────────────────────────────────────────────

function PricingTab({ trainer }) {
  const f = trainer.fields ?? {};

  const [prices, setPrices] = useState({
    Basic:   String(f.basicPrice   ?? ""),
    Premium: String(f.premiumPrice ?? ""),
    Ultra:   String(f.ultraPrice   ?? ""),
  });

  const [perks, setPerks] = useState({
    Basic:   parsePerks(f.basicPerks,   "Basic"),
    Premium: parsePerks(f.premiumPerks, "Premium"),
    Ultra:   parsePerks(f.ultraPerks,   "Ultra"),
  });

  const [newPerk, setNewPerk] = useState({ Basic: "", Premium: "", Ultra: "" });
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState("");

  function addPerk(tier) {
    const text = newPerk[tier].trim();
    if (!text) return;
    setPerks(prev => ({ ...prev, [tier]: [...prev[tier], text] }));
    setNewPerk(prev => ({ ...prev, [tier]: "" }));
  }

  function removePerk(tier, idx) {
    setPerks(prev => ({ ...prev, [tier]: prev[tier].filter((_, i) => i !== idx) }));
  }

  function movePerk(tier, idx, dir) {
    setPerks(prev => {
      const list = [...prev[tier]];
      const swap = idx + dir;
      if (swap < 0 || swap >= list.length) return prev;
      [list[idx], list[swap]] = [list[swap], list[idx]];
      return { ...prev, [tier]: list };
    });
  }

  function toggleFree(tier) {
    setPrices(prev => ({ ...prev, [tier]: prev[tier] === "0" ? "" : "0" }));
  }

  async function save() {
    setSaving(true); setMsg("");
    const res = await fetch("/api/commercial/trainer", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        basicPrice:   prices.Basic,
        premiumPrice: prices.Premium,
        ultraPrice:   prices.Ultra,
        basicPerks:   JSON.stringify(perks.Basic),
        premiumPerks: JSON.stringify(perks.Premium),
        ultraPerks:   JSON.stringify(perks.Ultra),
      }),
    });
    setSaving(false);
    setMsg(res.ok ? "Saved." : "Failed to save.");
  }

  const TIER_COLORS = {
    Basic:   { color: DS.safe,    bg: DS.safeBg,    border: DS.safeBorder   },
    Premium: { color: DS.caution, bg: DS.cautionBg, border: DS.cautionBorder },
    Ultra:   { color: DS.brand,   bg: DS.brandBg,   border: DS.brandBorder  },
  };

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm font-black" style={{ color: DS.bodyText }}>Tier pricing & features</p>
        <p className="text-xs mt-0.5" style={{ color: DS.labelText }}>
          Set prices and customize what each plan includes. Toggle "Free" to give open access at no cost.
        </p>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {["Basic", "Premium", "Ultra"].map(tier => {
          const tc     = TIER_COLORS[tier];
          const isFree = prices[tier] === "0";

          return (
            <div key={tier} className="rounded-sm overflow-hidden flex flex-col"
              style={{ backgroundColor: DS.cardBg, border: `1px solid ${tc.border}`, borderTop: `3px solid ${tc.color}` }}>

              <div className="px-4 py-3 border-b" style={{ borderColor: DS.border, backgroundColor: tc.bg }}>
                <div className="flex items-center justify-between mb-2.5">
                  <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: tc.color }}>
                    {tier}
                  </p>
                  <button type="button" onClick={() => toggleFree(tier)} className="flex items-center gap-2">
                    <div className="relative transition-colors"
                      style={{ width: 28, height: 16, borderRadius: 99, backgroundColor: isFree ? tc.color : DS.border }}>
                      <div className="absolute top-0.5 transition-all"
                        style={{ left: isFree ? 14 : 2, width: 12, height: 12, borderRadius: 99, backgroundColor: "#fff" }} />
                    </div>
                    <span className="text-[11px] font-bold" style={{ color: isFree ? tc.color : DS.labelText }}>
                      Free
                    </span>
                  </button>
                </div>

                {!isFree ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg font-black" style={{ color: DS.labelText }}>$</span>
                    <input
                      type="number" min="0"
                      className="w-24 px-2.5 py-1.5 rounded-sm text-lg font-black outline-none tabular-nums"
                      style={{ backgroundColor: DS.cardBg, border: `1px solid ${tc.border}`, color: DS.bodyText }}
                      placeholder="0"
                      value={prices[tier]}
                      onChange={e => setPrices(prev => ({ ...prev, [tier]: e.target.value }))}
                      onFocus={e => { e.target.style.borderColor = tc.color; e.target.style.boxShadow = `0 0 0 2px ${tc.color}20`; }}
                      onBlur={e  => { e.target.style.borderColor = tc.border; e.target.style.boxShadow = "none"; }}
                    />
                    <span className="text-xs" style={{ color: DS.dimText }}>/mo</span>
                  </div>
                ) : (
                  <p className="text-sm font-black" style={{ color: tc.color }}>Free access</p>
                )}
              </div>

              <div className="p-4 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: DS.dimText }}>
                  What's included
                </p>
                <div className="space-y-1.5 mb-3">
                  {perks[tier].map((perk, idx) => (
                    <div key={idx} className="flex items-start gap-2 group">
                      <span className="text-xs mt-0.5 shrink-0" style={{ color: tc.color }}>✓</span>
                      <span className="flex-1 text-xs leading-relaxed" style={{ color: DS.bodyText }}>{perk}</span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <button type="button" onClick={() => movePerk(tier, idx, -1)} disabled={idx === 0}
                          className="w-4 h-4 flex items-center justify-center rounded-sm disabled:opacity-20 transition text-[10px] leading-none"
                          style={{ color: DS.dimText }}>↑</button>
                        <button type="button" onClick={() => movePerk(tier, idx, 1)} disabled={idx === perks[tier].length - 1}
                          className="w-4 h-4 flex items-center justify-center rounded-sm disabled:opacity-20 transition text-[10px] leading-none"
                          style={{ color: DS.dimText }}>↓</button>
                        <button type="button" onClick={() => removePerk(tier, idx)}
                          className="w-4 h-4 flex items-center justify-center rounded-sm transition"
                          style={{ color: DS.dimText }}
                          onMouseEnter={e => { e.currentTarget.style.color = DS.banned; }}
                          onMouseLeave={e => { e.currentTarget.style.color = DS.dimText; }}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <input
                    className="flex-1 px-2 py-1.5 rounded-sm text-xs outline-none min-w-0"
                    style={{ backgroundColor: DS.pageBg, border: `1px solid ${DS.border}`, color: DS.bodyText }}
                    placeholder="Add a feature…"
                    value={newPerk[tier]}
                    onChange={e => setNewPerk(prev => ({ ...prev, [tier]: e.target.value }))}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPerk(tier); } }}
                    onFocus={e => { e.target.style.borderColor = tc.color; }}
                    onBlur={e =>  { e.target.style.borderColor = DS.border; }}
                  />
                  <button type="button" onClick={() => addPerk(tier)}
                    disabled={!newPerk[tier].trim()}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-xs font-bold shrink-0 disabled:opacity-40 transition"
                    style={{ backgroundColor: tc.bg, border: `1px solid ${tc.border}`, color: tc.color }}>
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={save} disabled={saving}
          className="px-5 py-2.5 rounded-sm text-xs font-black transition disabled:opacity-40"
          style={{ backgroundColor: DS.brand, color: "#fff" }}>
          {saving ? "Saving…" : "Save pricing & features"}
        </button>
        {msg && (
          <p className="text-xs font-bold" style={{ color: msg === "Saved." ? DS.safe : DS.banned }}>{msg}</p>
        )}
      </div>
      <p className="text-[11px] mt-2" style={{ color: DS.dimText }}>
        Clients see these features on your public profile before subscribing.
      </p>
    </div>
  );
}

// ─── Broadcast Modal ──────────────────────────────────────────────────────────

function BroadcastModal({ trainer, onClose }) {
  const f = trainer.fields ?? {};
  const [subject,    setSubject]    = useState("");
  const [body,       setBody]       = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [sending,    setSending]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState("");

  async function send() {
    if (!subject.trim()) { setError("Subject is required."); return; }
    if (!body.trim())    { setError("Message body is required."); return; }
    setSending(true); setError(""); setResult(null);
    const res  = await fetch("/api/commercial/email-broadcast", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, tierFilter }),
    });
    const data = await res.json();
    setSending(false);
    if (res.ok) setResult(data);
    else setError(data.error || "Failed to send.");
  }

  const inputStyle = {
    padding: "9px 12px", border: `1px solid ${DS.border}`, borderRadius: 6,
    fontSize: 13, fontFamily: "inherit", color: DS.bodyText, outline: "none",
    width: "100%", background: "#fff", boxSizing: "border-box",
  };
  const focus = {
    onFocus: e => { e.target.style.borderColor = DS.brand; e.target.style.boxShadow = `0 0 0 3px ${DS.brandBg}`; },
    onBlur:  e => { e.target.style.borderColor = DS.border; e.target.style.boxShadow = "none"; },
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto"
      style={{ paddingTop: 80, paddingBottom: 40, paddingLeft: 16, paddingRight: 16, backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-sm" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: DS.border }}>
          <div>
            <p className="text-sm font-black" style={{ color: DS.bodyText }}>Send Email</p>
            <p className="text-[11px]" style={{ color: DS.dimText }}>Broadcast to your active subscribers</p>
          </div>
          <button type="button" onClick={onClose}
            style={{ color: DS.dimText, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {result ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ backgroundColor: DS.safeBg, border: `1px solid ${DS.safeBorder}` }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke={DS.safe} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-sm font-black mb-1" style={{ color: DS.bodyText }}>
                Sent to {result.sent} subscriber{result.sent !== 1 ? "s" : ""}
              </p>
              {result.failed > 0 && (
                <p className="text-xs mb-2" style={{ color: DS.banned }}>{result.failed} failed to send</p>
              )}
              <button type="button" onClick={onClose}
                className="mt-3 px-5 py-2 rounded-sm text-xs font-black"
                style={{ backgroundColor: DS.brand, color: "#fff" }}>
                Done
              </button>
            </div>
          ) : (
            <>
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: DS.dimText, marginBottom: 6 }}>
                  Send to
                </p>
                <div className="flex gap-2 flex-wrap">
                  {["all", "Basic", "Premium", "Ultra"].map(t => (
                    <button key={t} type="button" onClick={() => setTierFilter(t)}
                      className="px-3 py-1.5 rounded-sm text-xs font-bold border transition"
                      style={{
                        backgroundColor: tierFilter === t ? DS.brand + "15" : "transparent",
                        borderColor:     tierFilter === t ? DS.brand + "55" : DS.border,
                        color:           tierFilter === t ? DS.brand : DS.labelText,
                      }}>
                      {t === "all" ? "All subscribers" : `${t} only`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: DS.dimText, marginBottom: 6 }}>Subject</p>
                <input style={inputStyle} {...focus}
                  value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="New program just dropped" />
              </div>

              <div>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: DS.dimText, marginBottom: 6 }}>Message</p>
                <textarea style={{ ...inputStyle, resize: "vertical", minHeight: 150, lineHeight: 1.7 }} {...focus}
                  value={body} onChange={e => setBody(e.target.value)}
                  placeholder={`Hey,\n\nJust posted a new 6-week strength block. Check it out in the library.\n\n- ${f.name || "Coach"}`} />
              </div>

              {error && <p style={{ fontSize: 12, color: DS.banned, fontWeight: 600 }}>{error}</p>}

              <div className="flex items-center justify-between pt-1">
                <p style={{ fontSize: 11, color: DS.dimText }}>Sent from your CheckPeak library address</p>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose}
                    style={{ padding: "9px 16px", borderRadius: 6, border: `1px solid ${DS.border}`, background: "transparent", color: DS.labelText, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                  <button type="button" onClick={send} disabled={sending}
                    style={{ padding: "9px 16px", borderRadius: 6, background: sending ? DS.brand + "99" : DS.brand, color: "#fff", border: "none", fontSize: 13, fontWeight: 700, cursor: sending ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    {sending ? "Sending…" : "Send email"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Clients Tab ──────────────────────────────────────────────────────────────

function ClientsTab({ trainer, clients, clientsLoading, loadClients, setClients }) {
  const slug = trainer.fields?.slug ?? "";
  const [showAdd,       setShowAdd]       = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [name,     setName]    = useState("");
  const [email,    setEmail]   = useState("");
  const [tier,     setTier]    = useState("Basic");
  const [saving,   setSaving]  = useState(false);
  const [addError, setAddError] = useState("");
  const [copied,   setCopied]  = useState(false);
  const [search,   setSearch]  = useState("");

  // Inline tier editing
  const [editingTierId, setEditingTierId] = useState(null);
  const [tierSaving,    setTierSaving]    = useState(false);

  // Inline remove confirmation (no window.confirm)
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  // Sync all existing clients to org athletes table
  const [syncing,  setSyncing]  = useState(false);
  const [syncMsg,  setSyncMsg]  = useState("");

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/trainer/${slug}/library`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function syncAll() {
    setSyncing(true); setSyncMsg("");
    const res  = await fetch("/api/commercial/sync-athletes", { method: "POST", credentials: "include" });
    const data = await res.json();
    setSyncing(false);
    if (res.ok) {
      setSyncMsg(data.synced > 0
        ? `${data.synced} client${data.synced !== 1 ? "s" : ""} synced.`
        : "All clients already synced.");
    } else {
      setSyncMsg(data.error || "Sync failed.");
    }
    setTimeout(() => setSyncMsg(""), 4000);
  }

  async function addClient(e) {
    e.preventDefault();
    if (!email || !tier) return;
    setSaving(true); setAddError("");
    const res = await fetch("/api/commercial/clients", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName: name, clientEmail: email, tier }),
    });
    if (res.ok) {
      setName(""); setEmail(""); setTier("Basic"); setShowAdd(false);
      loadClients();
    } else {
      setAddError((await res.json()).error ?? "Failed.");
    }
    setSaving(false);
  }

  async function changeTier(clientId, newTier) {
    setTierSaving(true);
    const res = await fetch(`/api/commercial/clients?id=${clientId}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: newTier }),
    });
    if (res.ok) {
      setClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, fields: { ...c.fields, tier: newTier } } : c
      ));
    }
    setTierSaving(false);
    setEditingTierId(null);
  }

  async function removeClient(clientId) {
    await fetch(`/api/commercial/clients?id=${clientId}`, { method: "DELETE", credentials: "include" });
    setClients(prev => prev.filter(c => c.id !== clientId));
    setConfirmRemoveId(null);
  }

  const active = clients?.filter(c => c.fields?.status === "active") ?? [];
  const filtered = search.trim()
    ? active.filter(c => {
        const q = search.trim().toLowerCase();
        return (c.fields?.clientName  || "").toLowerCase().includes(q)
            || (c.fields?.clientEmail || "").toLowerCase().includes(q);
      })
    : active;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <p className="text-sm font-black" style={{ color: DS.bodyText }}>
            {active.length > 0
              ? `${active.length} active client${active.length !== 1 ? "s" : ""}`
              : "No clients yet"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: DS.labelText }}>
            Add clients manually — they get an email with their library link.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={copyLink}
            className="px-3 py-1.5 rounded-sm text-xs font-bold border transition"
            style={{
              borderColor:     copied ? DS.safeBorder : DS.border,
              color:           copied ? DS.safe       : DS.labelText,
              backgroundColor: copied ? DS.safeBg     : DS.cardBg,
            }}>
            {copied ? "✓ Copied!" : "Copy library link"}
          </button>
          <button type="button" onClick={() => setShowBroadcast(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold border transition"
            style={{ borderColor: DS.border, color: DS.labelText, backgroundColor: DS.cardBg }}>
            <Mail className="w-3 h-3" /> Send Email
          </button>
          <button type="button" onClick={() => setShowAdd(v => !v)}
            className="px-3 py-1.5 rounded-sm text-xs font-black transition"
            style={{ backgroundColor: DS.brand, color: "#fff" }}>
            {showAdd ? "Cancel" : "+ Add client"}
          </button>
        </div>
      </div>

      {/* Org tools strip */}
      <div className="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 rounded-sm flex-wrap"
        style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}>
        <p className="text-[11px]" style={{ color: DS.brand }}>
          Clients added here automatically appear as athletes in your workout calendar and nutrition plans.
        </p>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <a href="/org/workouts-calendar" target="_blank" rel="noopener"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[11px] font-bold border transition"
            style={{ borderColor: DS.brandBorder, color: DS.brand, backgroundColor: "transparent" }}>
            <CalendarDays className="w-3 h-3" /> Workouts
          </a>
          <a href="/org/nutrition" target="_blank" rel="noopener"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[11px] font-bold border transition"
            style={{ borderColor: DS.brandBorder, color: DS.brand, backgroundColor: "transparent" }}>
            <Salad className="w-3 h-3" /> Nutrition
          </a>
          <button type="button" onClick={syncAll} disabled={syncing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[11px] font-bold border transition disabled:opacity-50"
            style={{ borderColor: DS.brandBorder, color: DS.brand, backgroundColor: "transparent" }}
            title="Sync all existing clients into your org's athlete list">
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync all"}
          </button>
          {syncMsg && (
            <span className="text-[11px] font-bold" style={{ color: DS.brand }}>{syncMsg}</span>
          )}
        </div>
      </div>

      {/* Add client form */}
      {showAdd && (
        <div className="rounded-sm mb-4 p-4" style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { label: "Name", value: name, set: setName, placeholder: "Client name", type: "text" },
              { label: "Email *", value: email, set: setEmail, placeholder: "client@email.com", type: "email" },
            ].map(({ label, value, set, placeholder, type }) => (
              <div key={label}>
                <label className="block text-[11px] font-bold mb-1" style={{ color: DS.labelText }}>{label}</label>
                <input type={type} className="w-full px-2.5 py-1.5 rounded-sm text-xs outline-none"
                  style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.bodyText }}
                  value={value} onChange={e => set(e.target.value)} placeholder={placeholder}
                  onFocus={e => { e.target.style.borderColor = DS.brand; }}
                  onBlur={e =>  { e.target.style.borderColor = DS.brandBorder; }} />
              </div>
            ))}
          </div>
          <div className="mb-3">
            <label className="block text-[11px] font-bold mb-1.5" style={{ color: DS.labelText }}>Tier</label>
            <div className="flex gap-2">
              {["Basic", "Premium", "Ultra"].map(t => {
                const ts = TIER_STYLE[t];
                return (
                  <button key={t} type="button" onClick={() => setTier(t)}
                    className="px-3 py-1.5 rounded-sm text-xs font-bold border transition"
                    style={{
                      backgroundColor: tier === t ? ts.bg          : DS.cardBg,
                      borderColor:     tier === t ? ts.color + "55" : DS.border,
                      color:           tier === t ? ts.color        : DS.labelText,
                    }}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          {addError && <p className="text-xs font-bold mb-2" style={{ color: DS.banned }}>{addError}</p>}
          <button type="button" onClick={addClient} disabled={saving || !email}
            className="px-4 py-2 rounded-sm text-xs font-black transition disabled:opacity-40"
            style={{ backgroundColor: DS.brand, color: "#fff" }}>
            {saving ? "Adding…" : "Add client"}
          </button>
        </div>
      )}

      {/* Search — only rendered once there are clients */}
      {active.length > 0 && (
        <div className="relative mb-3">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: DS.dimText }} />
          <input
            className="w-full pl-8 pr-3 py-1.5 rounded-sm text-xs outline-none"
            style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, color: DS.bodyText }}
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={e => { e.target.style.borderColor = DS.brand; }}
            onBlur={e =>  { e.target.style.borderColor = DS.border; }}
          />
        </div>
      )}

      {/* Client list */}
      {(clientsLoading || clients === null) ? (
        <div className="space-y-px">
          {[1,2,3].map(i => (
            <div key={i} className="animate-pulse h-14 rounded-sm"
              style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }} />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-sm"
          style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
          <Users className="w-8 h-8 mb-3" style={{ color: DS.brandBorder }} />
          <p className="text-sm font-black mb-1" style={{ color: DS.labelText }}>No clients yet</p>
          <p className="text-xs mb-4" style={{ color: DS.dimText }}>Add your first client to give them library access.</p>
          <button type="button" onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-sm text-xs font-black"
            style={{ backgroundColor: DS.brand, color: "#fff" }}>
            + Add first client
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center rounded-sm"
          style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
          <p className="text-xs font-bold" style={{ color: DS.dimText }}>No clients match "{search}"</p>
        </div>
      ) : (
        <div className="rounded-sm overflow-hidden"
          style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}` }}>
          {filtered.map((c, idx) => {
            const cf = c.fields ?? {};
            const ts = TIER_STYLE[cf.tier] ?? TIER_STYLE.Basic;
            const isEditingTier      = editingTierId   === c.id;
            const isConfirmingRemove = confirmRemoveId === c.id;

            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 border-b"
                style={{ borderColor: idx === filtered.length - 1 ? "transparent" : DS.border }}>

                {/* Avatar */}
                <div className="w-8 h-8 rounded-sm flex items-center justify-center shrink-0 text-xs font-black"
                  style={{ backgroundColor: DS.brandBg, color: DS.brand }}>
                  {(cf.clientName || cf.clientEmail || "?")[0].toUpperCase()}
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black truncate" style={{ color: DS.bodyText }}>{cf.clientName || "—"}</p>
                  <p className="text-[11px] truncate" style={{ color: DS.labelText }}>{cf.clientEmail}</p>
                </div>

                {/* Tier badge — click to enter edit mode */}
                {isEditingTier ? (
                  <div className="flex items-center gap-1 shrink-0">
                    {["Basic", "Premium", "Ultra"].map(t => {
                      const tts = TIER_STYLE[t];
                      const isCurrent = cf.tier === t;
                      return (
                        <button key={t} type="button"
                          disabled={tierSaving}
                          onClick={() => changeTier(c.id, t)}
                          className="px-2 py-0.5 rounded-sm text-[10px] font-black border transition disabled:opacity-50"
                          style={{
                            backgroundColor: isCurrent ? tts.bg    : "transparent",
                            borderColor:     isCurrent ? tts.color : DS.border,
                            color:           isCurrent ? tts.color : DS.labelText,
                          }}>
                          {t}
                        </button>
                      );
                    })}
                    <button type="button" onClick={() => setEditingTierId(null)}
                      className="ml-0.5 p-0.5 transition" style={{ color: DS.dimText }}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button type="button"
                    onClick={() => { setEditingTierId(c.id); setConfirmRemoveId(null); }}
                    title="Click to change tier"
                    className="px-2 py-0.5 rounded-sm text-[10px] font-black transition shrink-0"
                    style={{ backgroundColor: ts.bg, color: ts.color }}>
                    {cf.tier}
                  </button>
                )}

                {/* Start date */}
                <span className="text-[10px] hidden sm:inline shrink-0" style={{ color: DS.dimText }}>
                  Since {cf.startDate}
                </span>

                {/* Remove with inline two-step confirm */}
                {isConfirmingRemove ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => removeClient(c.id)}
                      className="text-[10px] font-black px-2 py-0.5 rounded-sm transition"
                      style={{ backgroundColor: DS.banned + "15", color: DS.banned, border: `1px solid ${DS.banned}40` }}>
                      Confirm
                    </button>
                    <button type="button" onClick={() => setConfirmRemoveId(null)}
                      className="text-[11px] font-bold" style={{ color: DS.dimText }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button type="button"
                    onClick={() => { setConfirmRemoveId(c.id); setEditingTierId(null); }}
                    className="text-[11px] font-bold transition shrink-0"
                    style={{ color: DS.dimText }}
                    onMouseEnter={e => { e.currentTarget.style.color = DS.banned; }}
                    onMouseLeave={e => { e.currentTarget.style.color = DS.dimText; }}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showBroadcast && (
        <BroadcastModal trainer={trainer} onClose={() => setShowBroadcast(false)} />
      )}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ trainer }) {
  const f = trainer.fields ?? {};
  const [name, setName] = useState(f.name ?? "");
  const [bio,  setBio]  = useState(f.bio  ?? "");
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState("");

  const [locked,     setLocked]     = useState(Boolean(f.libraryLocked));
  const [lockSaving, setLockSaving] = useState(false);
  const [lockMsg,    setLockMsg]    = useState("");

  const inputStyle = {
    backgroundColor: DS.brandBg,
    border: `1px solid ${DS.brandBorder}`,
    color: DS.bodyText,
  };

  async function save() {
    setSaving(true); setMsg("");
    const res = await fetch("/api/commercial/trainer", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, bio }),
    });
    setSaving(false);
    setMsg(res.ok ? "Saved." : "Failed to save.");
  }

  async function toggleLock() {
    const next = !locked;
    setLockSaving(true); setLockMsg("");
    const res = await fetch("/api/commercial/trainer", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libraryLocked: next }),
    });
    setLockSaving(false);
    if (res.ok) {
      setLocked(next);
      setLockMsg(next ? "Library locked." : "Library open.");
    } else {
      setLockMsg("Failed to update.");
    }
  }

  return (
    <div className="max-w-md">
      <div className="rounded-sm p-4 mb-4"
        style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${DS.brand}` }}>
        <p className="text-[10px] font-black uppercase tracking-wider mb-4" style={{ color: DS.brand }}>
          Profile
        </p>

        <div className="mb-4">
          <label className="block text-[11px] font-bold mb-1.5" style={{ color: DS.labelText }}>
            Display name
          </label>
          <input className="w-full px-2.5 py-1.5 rounded-sm text-xs outline-none"
            style={inputStyle} value={name} onChange={e => setName(e.target.value)}
            onFocus={e => { e.target.style.borderColor = DS.brand; }}
            onBlur={e =>  { e.target.style.borderColor = DS.brandBorder; }} />
        </div>

        <div className="mb-4">
          <label className="block text-[11px] font-bold mb-1.5" style={{ color: DS.labelText }}>
            Bio
          </label>
          <textarea className="w-full px-2.5 py-1.5 rounded-sm text-xs outline-none resize-none"
            style={{ ...inputStyle, minHeight: 80 }} value={bio} onChange={e => setBio(e.target.value)}
            onFocus={e => { e.target.style.borderColor = DS.brand; }}
            onBlur={e =>  { e.target.style.borderColor = DS.brandBorder; }} />
        </div>

        <p className="text-[11px]" style={{ color: DS.dimText }}>
          Public profile:{" "}
          <a href={`/trainer/${f.slug}`} target="_blank" rel="noopener"
            className="font-bold underline" style={{ color: DS.brand }}>
            checkpeak.com/trainer/{f.slug}
          </a>
        </p>
      </div>

      <div className="rounded-sm p-4 mb-4"
        style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${locked ? DS.caution : DS.safe}` }}>
        <p className="text-[10px] font-black uppercase tracking-wider mb-3" style={{ color: locked ? DS.caution : DS.safe }}>
          Library Access
        </p>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-xs font-black mb-1" style={{ color: DS.bodyText }}>
              {locked ? "Members only — library is closed" : "Open — anyone can join"}
            </p>
            <p className="text-[11px] leading-relaxed" style={{ color: DS.labelText }}>
              {locked
                ? "New subscriptions and purchases are blocked. Only your existing members can access your content."
                : "Anyone can discover your profile, subscribe, or buy content. Toggle this off to restrict access to existing members only."}
            </p>
          </div>
          <button type="button" onClick={lockSaving ? undefined : toggleLock} disabled={lockSaving}
            className="flex items-center gap-2 shrink-0 disabled:opacity-40 mt-0.5">
            <div className="relative transition-colors"
              style={{ width: 32, height: 18, borderRadius: 99, backgroundColor: locked ? DS.caution : DS.border }}>
              <div className="absolute top-0.5 transition-all"
                style={{ left: locked ? 16 : 2, width: 14, height: 14, borderRadius: 99, backgroundColor: "#fff" }} />
            </div>
          </button>
        </div>
        {lockMsg && (
          <p className="text-[11px] font-bold mt-3"
            style={{ color: lockMsg.includes("Failed") ? DS.banned : locked ? DS.caution : DS.safe }}>
            {lockMsg}
          </p>
        )}
      </div>

      {msg && <p className="text-xs font-bold mb-3" style={{ color: msg === "Saved." ? DS.safe : DS.banned }}>{msg}</p>}
      <button type="button" onClick={save} disabled={saving}
        className="px-5 py-2.5 rounded-sm text-xs font-black transition disabled:opacity-40"
        style={{ backgroundColor: DS.brand, color: "#fff" }}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function CommercialDashboard() {
  const router = useRouter();
  const { user, authReady } = useAuthContext();
  const [trainer,        setTrainer]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [tab,            setTab]            = useState("Library");
  const [videoCount,     setVideoCount]     = useState(0);
  const [clients,        setClients]        = useState(null);
  const [clientsLoading, setClientsLoading] = useState(false);

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    try {
      const r = await fetch("/api/commercial/clients", { credentials: "include" });
      if (r.ok) setClients((await r.json()).clients ?? []);
    } catch {}
    setClientsLoading(false);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) { router.push("/login"); return; }
    fetch("/api/commercial/trainer", { credentials: "include" })
      .then(res => {
        if (res.status === 404) { router.push("/commercial/onboard"); return null; }
        return res.json();
      })
      .then(data => { if (data?.trainer) setTrainer(data.trainer); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, authReady, router]);

  useEffect(() => {
    if (!trainer) return;
    fetch("/api/commercial/videos", { credentials: "include" })
      .then(r => r.json()).then(d => setVideoCount(d.videos?.length ?? 0)).catch(() => {});
    loadClients();
  }, [trainer, loadClients]);

  // Derive client count and tier breakdown from the shared clients array
  const tierBreakdown = useMemo(() => {
    const bd = { Basic: 0, Premium: 0, Ultra: 0 };
    (clients?.filter(c => c.fields?.status === "active") ?? []).forEach(c => {
      const t = c.fields?.tier;
      if (t === "Basic" || t === "Premium" || t === "Ultra") bd[t]++;
    });
    return bd;
  }, [clients]);

  const clientCount = (clients?.filter(c => c.fields?.status === "active") ?? []).length;

  if (!authReady || loading || !trainer) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: DS.pageBg }}>
        <div className="flex items-center gap-2 text-xs font-bold" style={{ color: DS.dimText }}>
          <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  const f = trainer.fields ?? {};

  return (
    <>
      <Head><title>{f.name} - CheckPeak Commercial</title></Head>
      <div className="min-h-screen" style={{ backgroundColor: DS.pageBg, color: DS.bodyText }}>

        <TopBar trainerName={f.name} router={router} />

        <div className="max-w-5xl mx-auto px-4 sm:px-5 py-5 pb-16">
          <TrainerHero
            trainer={trainer}
            videoCount={videoCount}
            clientCount={clientCount}
            tierBreakdown={tierBreakdown}
            onTabChange={setTab}
          />

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4">
            {TABS.map(t => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className="inline-flex items-center px-3 py-1.5 rounded-sm text-xs font-bold transition"
                style={{
                  backgroundColor: tab === t ? DS.brand + "15" : "transparent",
                  border: `1px solid ${tab === t ? DS.brand + "55" : DS.border}`,
                  color: tab === t ? DS.brand : DS.labelText,
                }}>
                {t}
              </button>
            ))}
          </div>

          {tab === "Library"   && <VideoLibrary trainerId={trainer.id} trainerSlug={f.slug} onVideoCountChange={setVideoCount} />}
          {tab === "Clients"   && (
            <ClientsTab
              trainer={trainer}
              clients={clients}
              clientsLoading={clientsLoading}
              loadClients={loadClients}
              setClients={setClients}
            />
          )}
          {tab === "Pricing"   && <PricingTab  trainer={trainer} />}
          {tab === "Analytics" && <AnalyticsTab />}
          {tab === "Settings"  && <SettingsTab trainer={trainer} />}
        </div>
      </div>
    </>
  );
}
