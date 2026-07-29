// pages/commercial/dashboard.jsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import VideoLibrary  from "@/components/commercial/VideoLibrary";
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
                {mrr > 0 ? `$${mrr.toLocaleString()}` : "-"}
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

      {/* Tier breakdown - bottom bar, only when there are tiered clients */}
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
      const parts = [];
      if (data.created > 0) parts.push(`${data.created} added to org`);
      if (data.updated > 0) parts.push(`${data.updated} name${data.updated !== 1 ? "s" : ""} updated`);
      setSyncMsg(parts.length > 0 ? parts.join(" · ") + "." : "All synced.");
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
            Add clients manually - they get an email with their library link.
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

      {/* Search - only rendered once there are clients */}
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
                  <p className="text-xs font-black truncate" style={{ color: DS.bodyText }}>{cf.clientName || "-"}</p>
                  <p className="text-[11px] truncate" style={{ color: DS.labelText }}>{cf.clientEmail}</p>
                </div>

                {/* Tier badge - click to enter edit mode */}
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
                    className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-black border transition shrink-0"
                    style={{ backgroundColor: ts.bg, color: ts.color, border: `1px solid ${ts.border}` }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = ts.color + "30"; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = ts.bg; }}>
                    {cf.tier}
                    <svg width="7" height="5" viewBox="0 0 7 5" fill="currentColor" style={{ opacity: 0.6, flexShrink: 0 }}><path d="M0 0l3.5 5L7 0z"/></svg>
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

// ─── Creator Agreement Text ───────────────────────────────────────────────────

const CREATOR_AGREEMENT_SECTIONS = [
  { heading: "CHECKPEAK — CREATOR PARTNER AGREEMENT", body: "Effective Date: July 29, 2026\n\nThis Creator Partner Agreement (\"Agreement\") is entered into between CheckPeak LLC, a Florida limited liability company (\"CheckPeak\" or \"Company\"), and the individual identified by signature below (\"Creator\")." },
  { heading: "1. PARTIES", body: "Company: CheckPeak LLC, a Florida limited liability company.\nCreator: The individual identified by signature below." },
  { heading: "2. DEFINITIONS", body: "\"Active Athlete\" — an athlete enrolled in a Referred Trainer's CheckPeak account who has logged in at least once during the thirty (30) days preceding the last day of the applicable billing period.\n\n\"Creator Code\" — the unique alphanumeric referral code assigned exclusively by CheckPeak to Creator.\n\n\"Qualified Referral\" — a trainer who (a) registers using Creator's Code at account creation, (b) activates a Subscription with 10+ Active Athletes, and (c) completes a first billing cycle with cleared payment.\n\n\"Referred Trainer\" — a trainer who satisfies all conditions to become a Qualified Referral.\n\n\"Recurring Commission Period\" — each calendar month a Referred Trainer maintains an active Subscription with 10+ Active Athletes and a successfully processed payment." },
  { heading: "3. PROGRAM OVERVIEW", body: "Creator agrees to participate in the CheckPeak Creator Partner Program by referring fitness trainers using Creator's unique Creator Code. Creator may promote CheckPeak through lawful means including personal outreach, social media, and in-person referrals. Creator has no authority to guarantee specific pricing, features, uptime, or performance outcomes to prospective trainers." },
  { heading: "4. CREATOR CODE & PROHIBITED CONDUCT", body: "Creator shall not:\n(a) Transfer, sell, sublicense, or share the Creator Code for compensation purposes;\n(b) Use the Creator Code with false, misleading, or deceptive promotion;\n(c) Artificially inflate referrals through self-referral, fictitious signups, bots, or collusion;\n(d) Promote CheckPeak alongside a competing platform in a misleading manner;\n(e) Use CheckPeak brand assets to promote a directly competing service.\n\nViolation shall constitute cause for immediate termination and may result in forfeiture of accrued compensation." },
  { heading: "5. COMPENSATION", body: "5.1 One-Time Referral Bonus: $49.99 per Qualified Referral, payable within 14 business days after the Referred Trainer's first billing cycle clears and their account reflects 10+ Active Athletes with no pending Clawback Event.\n\n5.2 Recurring Monthly Commission: $10.00 per Referred Trainer per calendar month during each active Recurring Commission Period. Terminates immediately if the Referred Trainer cancels, drops below 10 Active Athletes, or payment fails.\n\n5.3 No Cap: There is no limit on the number of Qualified Referrals Creator may generate.\n\n5.4 Clawback: If a payment is reversed within 90 days, CheckPeak will provide written notice within 5 business days and may deduct $49.99 from Creator's next payout. Clawback rights do not apply to recurring commissions." },
  { heading: "6. PAYMENT TERMS", body: "Payments via ACH bank transfer. Recurring commissions paid by the 15th of each month for prior month activity. One-time bonuses paid within 14 business days of qualification. Minimum payout threshold: $10.00. Undisputed amounts carry forward without expiration.\n\nPayment disputes must be submitted in writing within 60 days of the scheduled payment date. Late payments accrue simple interest at 1.5% per month after a 10-business-day cure period." },
  { heading: "7. TAX RESPONSIBILITY", body: "Creator is an independent contractor solely responsible for all applicable taxes. Creator must provide a completed IRS Form W-9 before receiving payment. CheckPeak will issue Form 1099-NEC for calendar years with total payments ≥ $600.00." },
  { heading: "8. QUALIFYING CONDITIONS & VERIFICATION", body: "CheckPeak's platform and payment processor records are authoritative for qualification determinations. Creator's Code must be entered at the time of initial account creation — no retroactive application under any circumstances. Disputed qualifications must be submitted in writing within 60 days of the relevant payment date." },
  { heading: "9. INTELLECTUAL PROPERTY", body: "All CheckPeak IP remains the exclusive property of CheckPeak LLC. Creator receives a limited, non-exclusive, revocable license to use CheckPeak's publicly available name and brand assets solely for truthful promotion of Creator's participation in the Program. Creator shall not alter brand assets, imply endorsements beyond this Agreement, or register any domain or handle containing \"CheckPeak.\"" },
  { heading: "10. CONFIDENTIALITY", body: "Creator shall hold all non-public CheckPeak information — including pricing strategy, compensation structure, business plans, and trainer/athlete data — in strict confidence. This obligation survives termination for three (3) years." },
  { heading: "11. MUTUAL NON-DISPARAGEMENT", body: "For two (2) years following termination, neither Party shall make false, misleading, or materially harmful public statements about the other Party. This does not prohibit truthful statements, legal testimony, or the pursuit of legal claims." },
  { heading: "12. INDEMNIFICATION", body: "Creator shall indemnify CheckPeak against claims arising from Creator's misrepresentations, Agreement violations, or unlawful promotional activity. CheckPeak shall indemnify Creator against claims arising from CheckPeak's material breach or third-party IP infringement claims against the Platform." },
  { heading: "13. INDEPENDENT CONTRACTOR", body: "Creator is an independent contractor. Creator has no authority to enter contracts on CheckPeak's behalf and is not entitled to employee benefits, workers' compensation, or unemployment insurance." },
  { heading: "14. LIMITATION OF LIABILITY", body: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, CHECKPEAK SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES. CHECKPEAK'S TOTAL CUMULATIVE LIABILITY SHALL NOT EXCEED THE TOTAL COMPENSATION PAID TO CREATOR IN THE THREE (3) CALENDAR MONTHS PRECEDING THE CLAIM." },
  { heading: "15. PROGRAM MODIFICATIONS", body: "CheckPeak may modify compensation rates, eligibility thresholds, and payment schedules upon 30 days written notice. Modifications do not affect already-earned bonuses or commissions in progress. Creator may terminate without penalty if modifications are not accepted." },
  { heading: "16. TERM & TERMINATION", body: "Either Party may terminate with 30 days written notice. CheckPeak may terminate immediately for material Agreement violations, fraudulent referral activity, or Creator conviction of a qualifying felony. Upon termination, all licenses are revoked immediately and earned, unpaid compensation is issued within 30 days." },
  { heading: "17–19. DISPUTE RESOLUTION, GOVERNING LAW & GENERAL", body: "Disputes proceed through negotiation (30 days), then non-binding mediation in Florida, then litigation. This Agreement is governed by Florida law. Venue is exclusively in Florida state or federal courts. This Agreement is the entire agreement between the Parties and supersedes all prior understandings. Electronic signatures are legally valid and binding under the Florida Electronic Signature Act and the federal ESIGN Act." },
];

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingSection({ title, color, children }) {
  const c = color ?? DS.brand;
  return (
    <div className="rounded-sm p-4 mb-4"
      style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, borderTop: `3px solid ${c}` }}>
      <p className="text-[10px] font-black uppercase tracking-wider mb-4" style={{ color: c }}>{title}</p>
      {children}
    </div>
  );
}

function SettingField({ label, hint, children }) {
  return (
    <div className="mb-4">
      <label className="block text-[11px] font-bold mb-1" style={{ color: DS.labelText }}>{label}</label>
      {hint && <p className="text-[10px] mb-1.5" style={{ color: DS.dimText }}>{hint}</p>}
      {children}
    </div>
  );
}

function SaveRow({ saving, msg, onSave }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button type="button" onClick={onSave} disabled={saving}
        className="px-4 py-2 rounded-sm text-xs font-black transition disabled:opacity-40"
        style={{ backgroundColor: DS.brand, color: "#fff" }}>
        {saving ? "Saving…" : "Save"}
      </button>
      {msg && <p className="text-xs font-bold" style={{ color: msg === "Saved." ? DS.safe : DS.banned }}>{msg}</p>}
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, saving, color }) {
  const c = color ?? DS.brand;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <p className="text-xs font-black mb-0.5" style={{ color: DS.bodyText }}>{label}</p>
        <p className="text-[11px] leading-relaxed" style={{ color: DS.labelText }}>{description}</p>
      </div>
      <button type="button" onClick={saving ? undefined : onChange} disabled={saving}
        className="shrink-0 disabled:opacity-40 mt-0.5">
        <div className="relative transition-colors" style={{ width: 32, height: 18, borderRadius: 99, backgroundColor: checked ? c : DS.border }}>
          <div className="absolute top-0.5 transition-all"
            style={{ left: checked ? 16 : 2, width: 14, height: 14, borderRadius: 99, backgroundColor: "#fff" }} />
        </div>
      </button>
    </div>
  );
}

function SettingsTab({ trainer }) {
  const f = trainer.fields ?? {};

  const inputCls = "w-full px-2.5 py-1.5 rounded-sm text-xs outline-none";
  const inputStyle = { backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.bodyText };
  const focusOn  = e => { e.target.style.borderColor = DS.brand; };
  const focusOff = e => { e.target.style.borderColor = DS.brandBorder; };

  // ── Profile ──
  const [name,      setName]      = useState(f.name      ?? "");
  const [specialty, setSpecialty] = useState(f.specialty ?? "");
  const [bio,       setBio]       = useState(f.bio       ?? "");
  const [profSaving, setProfSaving] = useState(false);
  const [profMsg,    setProfMsg]    = useState("");

  // ── Photo ──
  const [photoUrl,     setPhotoUrl]     = useState(f.photoUrl ?? "");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMsg,     setPhotoMsg]     = useState("");

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true); setPhotoMsg("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const up = await fetch("/api/upload/image", { method: "POST", credentials: "include", body: fd });
      const { url } = await up.json();
      if (!url) throw new Error("No URL");
      setPhotoUrl(url);
      await fetch("/api/commercial/trainer", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: url }),
      });
      setPhotoMsg("Photo saved.");
    } catch {
      setPhotoMsg("Upload failed.");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function saveProfile() {
    setProfSaving(true); setProfMsg("");
    const res = await fetch("/api/commercial/trainer", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, specialty, bio }),
    });
    setProfSaving(false);
    setProfMsg(res.ok ? "Saved." : "Failed to save.");
  }

  // ── Social links ──
  const [instagram, setInstagram] = useState(f.instagramUrl ?? "");
  const [youtube,   setYoutube]   = useState(f.youtubeUrl   ?? "");
  const [website,   setWebsite]   = useState(f.websiteUrl   ?? "");
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialMsg,    setSocialMsg]    = useState("");

  async function saveSocial() {
    setSocialSaving(true); setSocialMsg("");
    const res = await fetch("/api/commercial/trainer", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instagramUrl: instagram, youtubeUrl: youtube, websiteUrl: website }),
    });
    setSocialSaving(false);
    setSocialMsg(res.ok ? "Saved." : "Failed to save.");
  }

  // ── Welcome message ──
  const [welcome,      setWelcome]      = useState(f.welcomeMessage ?? "");
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeMsg,    setWelcomeMsg]    = useState("");

  async function saveWelcome() {
    setWelcomeSaving(true); setWelcomeMsg("");
    const res = await fetch("/api/commercial/trainer", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ welcomeMessage: welcome }),
    });
    setWelcomeSaving(false);
    setWelcomeMsg(res.ok ? "Saved." : "Failed to save.");
  }

  // ── Notifications ──
  const [notifyOnSub,    setNotifyOnSub]    = useState(f.notifyOnSubscribe !== false);
  const [notifySaving,   setNotifySaving]   = useState(false);
  const [notifyMsg,      setNotifyMsg]      = useState("");

  async function toggleNotify() {
    const next = !notifyOnSub;
    setNotifySaving(true); setNotifyMsg("");
    const res = await fetch("/api/commercial/trainer", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyOnSubscribe: next }),
    });
    setNotifySaving(false);
    if (res.ok) { setNotifyOnSub(next); setNotifyMsg(next ? "Notifications on." : "Notifications off."); }
    else setNotifyMsg("Failed to update.");
  }

  // ── Library lock ──
  const [locked,     setLocked]     = useState(Boolean(f.libraryLocked));
  const [lockSaving, setLockSaving] = useState(false);
  const [lockMsg,    setLockMsg]    = useState("");

  // ── Creator Program ──
  const [creatorAgreement,  setCreatorAgreement]  = useState(null);
  const [creatorLoaded,     setCreatorLoaded]     = useState(false);
  const [creatorReferrals,  setCreatorReferrals]  = useState(0);
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [creatorName,      setCreatorName]      = useState("");
  const [creatorCodeSuffix, setCreatorCodeSuffix] = useState("");
  const [creatorChecked,    setCreatorChecked]   = useState(false);
  const [creatorSaving,     setCreatorSaving]    = useState(false);
  const [creatorMsg,        setCreatorMsg]       = useState("");
  const [codeCopied,        setCodeCopied]       = useState(false);
  const [changingCode,      setChangingCode]     = useState(false);
  const [newCodeSuffix,     setNewCodeSuffix]    = useState("");
  const [changeCodeSaving,  setChangeCodeSaving] = useState(false);
  const [changeCodeMsg,     setChangeCodeMsg]    = useState("");

  async function toggleLock() {
    const next = !locked;
    setLockSaving(true); setLockMsg("");
    const res = await fetch("/api/commercial/trainer", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ libraryLocked: next }),
    });
    setLockSaving(false);
    if (res.ok) { setLocked(next); setLockMsg(next ? "Library locked." : "Library open."); }
    else setLockMsg("Failed to update.");
  }

  useEffect(() => {
    fetch("/api/commercial/creator-agreement", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setCreatorAgreement(d.agreement ?? null); setCreatorReferrals(d.referralCount ?? 0); setCreatorLoaded(true); })
      .catch(() => setCreatorLoaded(true));
  }, []);

  async function signCreatorAgreement() {
    if (!creatorName.trim() || !creatorChecked || creatorSaving) return;
    setCreatorSaving(true); setCreatorMsg("");
    try {
      const res = await fetch("/api/commercial/creator-agreement", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legalName: creatorName.trim(), creatorCode: `CP-${creatorCodeSuffix}` }),
      });
      const data = await res.json();
      if (res.ok || res.status === 409) {
        setCreatorAgreement(data.agreement);
        setShowCreatorModal(false);
      } else {
        setCreatorMsg(data.error || "Failed to sign agreement.");
      }
    } catch {
      setCreatorMsg("Something went wrong. Please try again.");
    }
    setCreatorSaving(false);
  }

  async function changeCreatorCode() {
    if (newCodeSuffix.length < 3 || changeCodeSaving) return;
    setChangeCodeSaving(true); setChangeCodeMsg("");
    try {
      const res = await fetch("/api/commercial/creator-agreement", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorCode: `CP-${newCodeSuffix}` }),
      });
      const data = await res.json();
      if (res.ok) {
        setCreatorAgreement(data.agreement);
        setChangingCode(false);
        setNewCodeSuffix("");
      } else {
        setChangeCodeMsg(data.error || "Failed to update code.");
      }
    } catch {
      setChangeCodeMsg("Something went wrong.");
    }
    setChangeCodeSaving(false);
  }

  function copyCreatorCode() {
    const code = creatorAgreement?.fields?.creatorCode ?? "";
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  return (
    <div>

      {/* ── Row 1: Profile + Online Presence ── */}
      <div className="grid gap-4 mb-0" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>

        <SettingSection title="Profile">
          <SettingField label="Banner photo" hint="Displayed across the top of your Arena card. Best results with a wide landscape crop - recommended 1200 × 400 px (3:1). Portrait photos work too; we show from the top down.">
            <div className="flex items-center gap-3 mb-1">
              <div style={{ width: 88, height: 30, borderRadius: 3, overflow: "hidden", background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {photoUrl
                  ? <img src={photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
                  : <span style={{ fontSize: 9, fontWeight: 700, color: DS.brand, letterSpacing: "0.06em", textTransform: "uppercase" }}>No photo</span>
                }
              </div>
              <div>
                <label style={{ display: "inline-block", padding: "5px 12px", background: DS.brandBg, border: `1px solid ${DS.brandBorder}`, borderRadius: 3, fontSize: 11, fontWeight: 700, color: DS.bodyText, cursor: photoUploading ? "not-allowed" : "pointer", opacity: photoUploading ? 0.5 : 1 }}>
                  {photoUploading ? "Uploading…" : "Choose photo"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={uploadPhoto} disabled={photoUploading} />
                </label>
                {photoMsg && <p className="text-[10px] mt-1 font-bold" style={{ color: photoMsg === "Photo saved." ? DS.safe : DS.banned }}>{photoMsg}</p>}
              </div>
            </div>
          </SettingField>

          <SettingField label="Display name">
            <input className={inputCls} style={inputStyle} value={name}
              onChange={e => setName(e.target.value)} onFocus={focusOn} onBlur={focusOff} />
          </SettingField>

          <SettingField label="Specialty" hint="Shown under your name on your public profile.">
            <input className={inputCls} style={inputStyle} value={specialty}
              placeholder="e.g. Strength & Conditioning Coach"
              onChange={e => setSpecialty(e.target.value)} onFocus={focusOn} onBlur={focusOff} />
          </SettingField>

          <SettingField label="Bio">
            <textarea className={`${inputCls} resize-none`} style={{ ...inputStyle, minHeight: 80 }}
              value={bio} onChange={e => setBio(e.target.value)} onFocus={focusOn} onBlur={focusOff} />
          </SettingField>

          <p className="text-[11px] mb-3" style={{ color: DS.dimText }}>
            Public profile:{" "}
            <a href={`/trainer/${f.slug}`} target="_blank" rel="noopener"
              className="font-bold underline" style={{ color: DS.brand }}>
              checkpeak.com/trainer/{f.slug}
            </a>
          </p>

          <SaveRow saving={profSaving} msg={profMsg} onSave={saveProfile} />
        </SettingSection>

        <SettingSection title="Online Presence">
          {[
            { label: "Instagram", value: instagram, set: setInstagram, placeholder: "https://instagram.com/yourhandle" },
            { label: "YouTube",   value: youtube,   set: setYoutube,   placeholder: "https://youtube.com/@yourchannel" },
            { label: "Website",   value: website,   set: setWebsite,   placeholder: "https://yourwebsite.com" },
          ].map(({ label, value, set, placeholder }) => (
            <SettingField key={label} label={label}>
              <input type="url" className={inputCls} style={inputStyle} value={value}
                placeholder={placeholder}
                onChange={e => set(e.target.value)} onFocus={focusOn} onBlur={focusOff} />
            </SettingField>
          ))}
          <p className="text-[10px] mb-3" style={{ color: DS.dimText }}>
            Links appear on your public profile page so clients can follow you.
          </p>
          <SaveRow saving={socialSaving} msg={socialMsg} onSave={saveSocial} />
        </SettingSection>

      </div>

      {/* ── Row 2: Welcome Message (full width) ── */}
      <SettingSection title="Welcome Message">
        <SettingField
          label="Message to new subscribers"
          hint="Included in the access email sent when you add a client. Introduce yourself, set expectations, or share a next step.">
          <textarea className={`${inputCls} resize-none`}
            style={{ ...inputStyle, minHeight: 100 }}
            value={welcome}
            placeholder="Hey! So excited to have you. Start with the Foundations playlist and let me know if you have any questions."
            onChange={e => setWelcome(e.target.value)}
            onFocus={focusOn} onBlur={focusOff} />
        </SettingField>
        <SaveRow saving={welcomeSaving} msg={welcomeMsg} onSave={saveWelcome} />
      </SettingSection>

      {/* ── Row 3: Notifications + Library Access ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>

        <SettingSection title="Notifications">
          <ToggleRow
            label="New subscriber alerts"
            description="Get an email when someone subscribes to or is added to your library."
            checked={notifyOnSub}
            onChange={toggleNotify}
            saving={notifySaving}
          />
          {notifyMsg && (
            <p className="text-[11px] font-bold mt-3"
              style={{ color: notifyMsg.includes("Failed") ? DS.banned : DS.safe }}>
              {notifyMsg}
            </p>
          )}
        </SettingSection>

        <SettingSection title="Library Access" color={locked ? DS.caution : DS.safe}>
          <ToggleRow
            label={locked ? "Members only - library is closed" : "Open - anyone can join"}
            description={locked
              ? "New subscriptions and purchases are blocked. Only your existing members can access your content."
              : "Anyone can discover your profile, subscribe, or buy content. Toggle to restrict access to existing members only."}
            checked={locked}
            onChange={toggleLock}
            saving={lockSaving}
            color={locked ? DS.caution : DS.safe}
          />
          {lockMsg && (
            <p className="text-[11px] font-bold mt-3"
              style={{ color: lockMsg.includes("Failed") ? DS.banned : locked ? DS.caution : DS.safe }}>
              {lockMsg}
            </p>
          )}
        </SettingSection>

      </div>

      {/* ── Row 4: Creator Partner Program ── */}
      <SettingSection title="Creator Partner Program" color={creatorAgreement ? DS.safe : DS.brand}>
        {!creatorLoaded ? (
          <p className="text-xs" style={{ color: DS.dimText }}>Loading…</p>
        ) : creatorAgreement ? (
          // ── Signed — show code ──
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="px-2 py-0.5 rounded-sm text-[10px] font-black tracking-wider uppercase"
                style={{ backgroundColor: DS.safeBg, color: DS.safe, border: `1px solid ${DS.safeBorder}` }}>
                Active Creator Partner
              </div>
              <span className="text-[11px]" style={{ color: DS.dimText }}>
                Signed {new Date(creatorAgreement.fields?.signedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
            </div>

            <p className="text-[11px] mb-2 font-bold" style={{ color: DS.labelText }}>Your Creator Code</p>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 px-3 py-2 rounded-sm font-black text-sm tracking-widest select-all"
                style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.brand, fontFamily: "monospace" }}>
                {creatorAgreement.fields?.creatorCode}
              </div>
              <button type="button" onClick={copyCreatorCode}
                className="px-3 py-2 rounded-sm text-xs font-black transition shrink-0"
                style={{ backgroundColor: codeCopied ? DS.safeBg : DS.brand, color: codeCopied ? DS.safe : "#fff", border: codeCopied ? `1px solid ${DS.safeBorder}` : "none" }}>
                {codeCopied ? "Copied!" : "Copy"}
              </button>
            </div>

            {(() => {
              const lastChanged = creatorAgreement.fields?.codeChangedAt ?? creatorAgreement.fields?.signedAt;
              const nextAllowed = lastChanged ? new Date(new Date(lastChanged).setMonth(new Date(lastChanged).getMonth() + 6)) : null;
              const locked = nextAllowed && new Date() < nextAllowed;
              if (locked && !changingCode) return (
                <p className="text-[11px] mb-4" style={{ color: DS.dimText }}>
                  Code locked until <span className="font-bold" style={{ color: DS.labelText }}>
                    {nextAllowed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </span> — codes can be changed once every 6 months.
                </p>
              );
              return null;
            })()}
            {changingCode ? (
              <div className="mb-4">
                <p className="text-[11px] font-bold mb-1.5" style={{ color: DS.labelText }}>New Creator Code</p>
                <div className="flex items-center gap-2">
                  <div className="flex items-center rounded-sm overflow-hidden flex-1"
                    style={{ border: `1px solid ${DS.brandBorder}` }}>
                    <span className="px-2.5 py-1.5 text-xs font-black shrink-0"
                      style={{ backgroundColor: DS.brandBg, color: DS.brand, borderRight: `1px solid ${DS.brandBorder}` }}>
                      CP-
                    </span>
                    <input
                      className="flex-1 px-2.5 py-1.5 text-xs font-black outline-none tracking-widest"
                      style={{ backgroundColor: DS.cardBg, color: DS.bodyText }}
                      placeholder="NEWNAME"
                      maxLength={12}
                      autoFocus
                      value={newCodeSuffix}
                      onChange={e => { setNewCodeSuffix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")); setChangeCodeMsg(""); }}
                    />
                  </div>
                  <button type="button" onClick={changeCreatorCode}
                    disabled={newCodeSuffix.length < 3 || changeCodeSaving}
                    className="px-3 py-1.5 rounded-sm text-xs font-black transition disabled:opacity-40"
                    style={{ backgroundColor: DS.brand, color: "#fff" }}>
                    {changeCodeSaving ? "Saving…" : "Save"}
                  </button>
                  <button type="button" onClick={() => { setChangingCode(false); setNewCodeSuffix(""); setChangeCodeMsg(""); }}
                    className="px-3 py-1.5 rounded-sm text-xs font-bold transition"
                    style={{ color: DS.labelText }}>
                    Cancel
                  </button>
                </div>
                {changeCodeMsg && <p className="text-[11px] font-bold mt-1.5" style={{ color: DS.banned }}>{changeCodeMsg}</p>}
              </div>
            ) : (() => {
              const lastChanged = creatorAgreement.fields?.codeChangedAt ?? creatorAgreement.fields?.signedAt;
              const nextAllowed = lastChanged ? new Date(new Date(lastChanged).setMonth(new Date(lastChanged).getMonth() + 6)) : null;
              const locked = nextAllowed && new Date() < nextAllowed;
              if (locked) return null;
              return (
                <button type="button" onClick={() => { setChangingCode(true); setNewCodeSuffix(""); setChangeCodeMsg(""); }}
                  className="text-[11px] font-bold mb-4 transition"
                  style={{ color: DS.brand }}>
                  Change code
                </button>
              );
            })()}

            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Referral Bonus", value: "$49.99", sub: "per qualified trainer" },
                { label: "Monthly Commission", value: "$10.00", sub: "per active trainer/mo" },
                { label: "Trainers Referred", value: creatorReferrals, sub: "signed up with your code" },
              ].map(({ label, value, sub }) => (
                <div key={label} className="p-3 rounded-sm text-center"
                  style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}>
                  <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: DS.dimText }}>{label}</p>
                  <p className="text-lg font-black" style={{ color: DS.brand, fontFamily: "'Barlow Condensed', sans-serif" }}>{value}</p>
                  <p className="text-[10px]" style={{ color: DS.dimText }}>{sub}</p>
                </div>
              ))}
            </div>

            <p className="text-[11px]" style={{ color: DS.dimText }}>
              Share your code with trainers at signup. When they activate with 10+ athletes and complete their first billing cycle, you earn the referral bonus — plus $10/month for as long as they stay active.
            </p>
          </div>
        ) : (
          // ── Not signed — invite to join ──
          <div>
            <p className="text-xs mb-3" style={{ color: DS.bodyText }}>
              Refer fitness trainers to CheckPeak and earn for every coach who joins and grows their program.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Referral Bonus", value: "$49.99", sub: "one-time per qualified trainer" },
                { label: "Monthly Commission", value: "$10/mo", sub: "per active trainer, no cap" },
              ].map(({ label, value, sub }) => (
                <div key={label} className="p-3 rounded-sm"
                  style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}` }}>
                  <p className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: DS.dimText }}>{label}</p>
                  <p className="text-base font-black" style={{ color: DS.brand, fontFamily: "'Barlow Condensed', sans-serif" }}>{value}</p>
                  <p className="text-[10px]" style={{ color: DS.dimText }}>{sub}</p>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setShowCreatorModal(true)}
              className="px-4 py-2 rounded-sm text-xs font-black transition"
              style={{ backgroundColor: DS.brand, color: "#fff" }}>
              View Agreement &amp; Join
            </button>
          </div>
        )}
      </SettingSection>

      {/* ── Creator Agreement Modal ── */}
      {showCreatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreatorModal(false); }}>
          <div className="w-full max-w-2xl rounded-sm shadow-2xl flex flex-col"
            style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.border}`, maxHeight: "90vh" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0"
              style={{ borderBottom: `1px solid ${DS.border}` }}>
              <div>
                <p className="text-sm font-black" style={{ color: DS.bodyText }}>Creator Partner Agreement</p>
                <p className="text-[11px] mt-0.5" style={{ color: DS.dimText }}>CheckPeak LLC · State of Florida</p>
              </div>
              <button type="button" onClick={() => setShowCreatorModal(false)}
                className="p-1 rounded-sm transition" style={{ color: DS.dimText }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable agreement */}
            <div className="overflow-y-auto px-5 py-4 flex-1" style={{ minHeight: 0 }}>
              {CREATOR_AGREEMENT_SECTIONS.map(({ heading, body }) => (
                <div key={heading} className="mb-5">
                  <p className="text-[10px] font-black uppercase tracking-wider mb-1.5"
                    style={{ color: DS.brand }}>{heading}</p>
                  <p className="text-[11px] leading-relaxed whitespace-pre-line"
                    style={{ color: DS.bodyText }}>{body}</p>
                </div>
              ))}
            </div>

            {/* Signature fields */}
            <div className="px-5 py-4 shrink-0" style={{ borderTop: `1px solid ${DS.border}`, backgroundColor: DS.pageBg }}>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-bold mb-1" style={{ color: DS.labelText }}>
                    Legal Name <span style={{ color: DS.banned }}>*</span>
                  </label>
                  <input
                    className="w-full px-2.5 py-1.5 rounded-sm text-xs outline-none"
                    style={{ backgroundColor: DS.cardBg, border: `1px solid ${DS.brandBorder}`, color: DS.bodyText }}
                    placeholder="Your full legal name"
                    value={creatorName}
                    onChange={e => setCreatorName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold mb-1" style={{ color: DS.labelText }}>Date</label>
                  <div className="w-full px-2.5 py-1.5 rounded-sm text-xs"
                    style={{ backgroundColor: DS.brandBg, border: `1px solid ${DS.brandBorder}`, color: DS.labelText }}>
                    {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-[11px] font-bold mb-1" style={{ color: DS.labelText }}>
                  Choose Your Creator Code <span style={{ color: DS.banned }}>*</span>
                </label>
                <div className="flex items-center rounded-sm overflow-hidden"
                  style={{ border: `1px solid ${DS.brandBorder}` }}>
                  <span className="px-2.5 py-1.5 text-xs font-black shrink-0"
                    style={{ backgroundColor: DS.brandBg, color: DS.brand, borderRight: `1px solid ${DS.brandBorder}` }}>
                    CP-
                  </span>
                  <input
                    className="flex-1 px-2.5 py-1.5 text-xs font-black outline-none tracking-widest"
                    style={{ backgroundColor: DS.cardBg, color: DS.bodyText }}
                    placeholder="YOURNAME"
                    maxLength={12}
                    value={creatorCodeSuffix}
                    onChange={e => setCreatorCodeSuffix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  />
                </div>
                <p className="text-[10px] mt-1" style={{ color: DS.dimText }}>
                  Letters and numbers only, 3–12 characters. This is permanent and unique to you.
                </p>
              </div>

              <label className="flex items-start gap-2 mb-4 cursor-pointer">
                <input type="checkbox" className="mt-0.5 shrink-0"
                  checked={creatorChecked} onChange={e => setCreatorChecked(e.target.checked)} />
                <span className="text-[11px] leading-relaxed" style={{ color: DS.bodyText }}>
                  I have read, understand, and agree to the CheckPeak Creator Partner Agreement, including all terms regarding compensation, prohibited conduct, confidentiality, and dispute resolution. I confirm I have the full legal authority to enter into this Agreement.
                </span>
              </label>

              <div className="flex items-center gap-3">
                <button type="button"
                  onClick={signCreatorAgreement}
                  disabled={!creatorName.trim() || creatorCodeSuffix.length < 3 || !creatorChecked || creatorSaving}
                  className="px-5 py-2 rounded-sm text-xs font-black transition disabled:opacity-40"
                  style={{ backgroundColor: DS.brand, color: "#fff" }}>
                  {creatorSaving ? "Signing…" : "Sign Agreement & Get My Code"}
                </button>
                <button type="button" onClick={() => setShowCreatorModal(false)}
                  className="px-4 py-2 rounded-sm text-xs font-bold transition"
                  style={{ color: DS.labelText }}>
                  Cancel
                </button>
                {creatorMsg && (
                  <p className="text-[11px] font-bold" style={{ color: DS.banned }}>{creatorMsg}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
