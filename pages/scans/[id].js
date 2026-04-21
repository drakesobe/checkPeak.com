// pages/scans/[id].js — CheckPeak Scan Detail (redesigned)
// Preserves: rename, delete, share toggle, re-analyze, all data fields
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useAuthContext } from "@/hooks/useAuth";
import { trackEvent } from "@/lib/analytics";
import {
  ArrowLeft, Share2, Trash2, RefreshCw,
  AlertTriangle, Shield, Link2, X, Pencil, Check, Info,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
const CP = {
  black:   "#060810",
  surface: "#0C1525",
  raised:  "#111E30",
  border:  "rgba(255,255,255,0.08)",
  accent:  "#4FABFF",
  white:   "#FFFFFF",
  ghost:   "rgba(255,255,255,0.55)",
  dim:     "rgba(255,255,255,0.30)",
  faint:   "rgba(255,255,255,0.12)",
  red:     "#D92B3A",
  amber:   "#D4900A",
  green:   "#0D9A55",
  purple:  "#7C3FBB",
  fontBC:  "'Barlow Condensed', 'Arial Narrow', sans-serif",
  fontB:   "'Barlow', Arial, sans-serif",
};

const DETAIL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,700;0,900;1,900&family=Barlow:wght@400;500;600&display=swap');

  @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
  @keyframes sd-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  .sd-spin { animation:sd-spin .9s linear infinite; }

  .sd-grid  { display:grid; grid-template-columns:1fr 320px; gap:16px; align-items:start; }
  .sd-tiles { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .sd-meta  { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }

  .sd-table-wrap { overflow-x:auto; }
  .sd-table      { width:100%; border-collapse:collapse; }
  .sd-table th   {
    padding:10px 14px; text-align:left;
    font-family:'Barlow Condensed','Arial Narrow',sans-serif;
    font-size:10px; font-weight:700; letter-spacing:.14em;
    text-transform:uppercase; color:rgba(255,255,255,.30);
    border-bottom:.5px solid rgba(255,255,255,.08);
    white-space:nowrap;
  }
  .sd-table td {
    padding:13px 14px; border-bottom:.5px solid rgba(255,255,255,.06);
    vertical-align:top;
    font-family:'Barlow',Arial,sans-serif; font-size:13px;
    color:rgba(255,255,255,.55); line-height:1.6;
  }
  .sd-table tr:last-child td { border-bottom:none; }
  .sd-table tr:hover td      { background:rgba(255,255,255,.02); }
  .sd-table td strong        { color:#fff; font-weight:600; display:block; margin-bottom:2px; }

  @media (max-width:900px) {
    .sd-grid  { grid-template-columns:1fr; }
    .sd-tiles { grid-template-columns:repeat(2,1fr); }
  }
  @media (max-width:560px) {
    .sd-tiles { grid-template-columns:1fr; }
  }
`;

// ---------------------------------------------------------------------------
// Logic — unchanged from original file
// ---------------------------------------------------------------------------
function getCounts(scan) {
  if (!scan) return { prohibitedCount:0, limitedCount:0, otherCount:0 };
  const fp = scan.prohibitedCount ?? 0;
  const fl = scan.limitedCount    ?? 0;
  const fo = scan.otherCount      ?? 0;
  const bannedMatches        = Array.isArray(scan.matchedBanned)      ? scan.matchedBanned      : [];
  const ingredientMatchCount = Array.isArray(scan.matchedIngredients) ? scan.matchedIngredients.length : 0;
  if (!bannedMatches.length && !ingredientMatchCount) return { prohibitedCount:fp, limitedCount:fl, otherCount:fo };
  let prohibited=0, limited=0, other=0;
  for (const b of bannedMatches) {
    const raw = (b?.fields?.["Ban Type"]||"").toString().trim().toLowerCase();
    if (!raw) { other++; continue; }
    if (raw.includes("prohibited")||raw.includes("in-competition")||raw.includes("in competition")||raw.includes("banned")) prohibited++;
    else if (raw.includes("limited")||raw.includes("out of competition")||raw.includes("out-of-competition")||raw.includes("threshold")) limited++;
    else other++;
  }
  const totalOther = other + ingredientMatchCount;
  if (!prohibited && !limited && !totalOther) return { prohibitedCount:fp, limitedCount:fl, otherCount:fo };
  return { prohibitedCount:prohibited, limitedCount:limited, otherCount:totalOther };
}

function computeRiskFromCounts(counts) {
  const p = Number(counts?.prohibitedCount||0);
  const l = Number(counts?.limitedCount   ||0);
  const o = Number(counts?.otherCount     ||0);
  if (p>0) return { label:"High Risk",    detail:`${p} prohibited substance${p>1?"s":""} found`,        color:"#D92B3A", Icon:AlertTriangle };
  if (l>0) return { label:"Moderate Risk",detail:`${l} limited/threshold substance${l>1?"s":""}`,        color:"#D4900A", Icon:AlertTriangle };
  if (o>0) return { label:"Needs Review", detail:`${o} other flag${o>1?"s":""} detected`,                color:"#7C3FBB", Icon:Info          };
  return       { label:"Low Risk",    detail:"No prohibited, limited, or other flags detected", color:"#0D9A55", Icon:Shield        };
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------
function Eyebrow({ children, color }) {
  return (
    <p style={{ fontFamily:CP.fontBC, fontSize:"10px", fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase", color:color||CP.dim, display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
      <span style={{ display:"block", width:"20px", height:"0.5px", background:color||CP.faint, flexShrink:0 }} />
      {children}
    </p>
  );
}

function Card({ children, accentColor, style }) {
  return (
    <div style={{ background:CP.surface, border:`0.5px solid ${CP.border}`, borderTop:`2px solid ${accentColor||CP.border}`, padding:"20px 22px", ...style }}>
      {children}
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, danger, ghost, loading, style }) {
  return (
    <button onClick={onClick} disabled={disabled||loading} style={{
      display:"inline-flex", alignItems:"center", gap:"7px",
      padding:"9px 18px",
      fontFamily:CP.fontBC, fontSize:"12px", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
      background: danger ? "rgba(217,43,58,0.1)" : ghost ? "transparent" : CP.accent,
      color:      danger ? CP.red               : ghost ? CP.dim        : CP.black,
      border:     danger ? `0.5px solid rgba(217,43,58,0.3)` : ghost ? `0.5px solid ${CP.border}` : "none",
      cursor:     disabled||loading ? "not-allowed" : "pointer",
      opacity:    disabled||loading ? 0.55 : 1,
      transition: "opacity .18s",
      ...style,
    }}>
      {children}
    </button>
  );
}

function MetaPill({ children, color }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"6px", padding:"5px 13px", fontFamily:CP.fontB, fontSize:"12px", color:color||CP.ghost, background:"rgba(255,255,255,0.04)", border:`0.5px solid ${CP.border}` }}>
      {children}
    </span>
  );
}

function Skeleton({ height="80px" }) {
  return (
    <div style={{ height, background:CP.surface, border:`0.5px solid ${CP.border}`, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)", animation:"shimmer 1.6s infinite" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
function BannedTable({ records }) {
  if (!records.length) return (
    <p style={{ fontFamily:CP.fontB, fontSize:"13px", color:CP.dim, fontStyle:"italic" }}>
      No banned substances matched for this scan.
    </p>
  );
  return (
    <div className="sd-table-wrap">
      <table className="sd-table">
        <thead><tr>{["Substance","Ban Type","Banned By","Notes","Matched Terms"].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {records.map(b => {
            const banType  = b?.fields?.["Ban Type"] || "—";
            const raw      = banType.toLowerCase();
            const banColor = raw.includes("prohibited")||raw.includes("banned") ? CP.red
                           : raw.includes("limited")||raw.includes("threshold") ? CP.amber : CP.ghost;
            return (
              <tr key={b.id}>
                <td>
                  <strong>{b.fields?.["Substance Name"]||b.fields?.Name||"Unknown"}</strong>
                  {b.fields?.Synonyms && <span style={{ fontSize:"11px", color:CP.dim }}>{String(b.fields.Synonyms).slice(0,120)}{String(b.fields.Synonyms).length>120?"…":""}</span>}
                </td>
                <td>
                  <span style={{ display:"inline-block", padding:"3px 10px", fontFamily:CP.fontBC, fontSize:"11px", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:banColor, background:`${banColor}18`, border:`0.5px solid ${banColor}44` }}>
                    {banType}
                  </span>
                </td>
                <td>{b.fields?.["Banned By"]||"—"}</td>
                <td>{b.fields?.Notes ? String(b.fields.Notes).slice(0,160)+(String(b.fields.Notes).length>160?"…":"") : "—"}</td>
                <td>
                  {Array.isArray(b.matchedTerms)&&b.matchedTerms.length
                    ? b.matchedTerms.map((t,i)=><span key={i} style={{ display:"inline-block", marginRight:"4px", marginBottom:"3px", padding:"2px 7px", fontFamily:CP.fontBC, fontSize:"10px", letterSpacing:"0.06em", textTransform:"uppercase", color:CP.accent, background:"rgba(79,171,255,0.08)", border:`0.5px solid rgba(79,171,255,0.2)` }}>{t}</span>)
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IngredientsTable({ records }) {
  if (!records.length) return (
    <p style={{ fontFamily:CP.fontB, fontSize:"13px", color:CP.dim, fontStyle:"italic" }}>
      No ingredients from your database matched for this scan yet.
    </p>
  );
  return (
    <div className="sd-table-wrap">
      <table className="sd-table">
        <thead><tr>{["Ingredient","Benefits","Weaknesses","Antagonisms","Matched Terms"].map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {records.map(ing => (
            <tr key={ing.id}>
              <td>
                <strong>{ing.fields?.["Name"]||ing.fields?.["Ingredient Name"]||"Unknown"}</strong>
                {ing.fields?.["Synonyms (Extended)"] && <span style={{ fontSize:"11px", color:CP.dim }}>{String(ing.fields["Synonyms (Extended)"]).slice(0,120)}{String(ing.fields["Synonyms (Extended)"]).length>120?"…":""}</span>}
              </td>
              {["Benefits","Weaknesses","Nutrient Antagonism"].map(field=>(
                <td key={field}>{ing.fields?.[field] ? String(ing.fields[field]).slice(0,160)+(String(ing.fields[field]).length>160?"…":"") : "—"}</td>
              ))}
              <td>
                {Array.isArray(ing.matchedTerms)&&ing.matchedTerms.length
                  ? ing.matchedTerms.map((t,i)=><span key={i} style={{ display:"inline-block", marginRight:"4px", marginBottom:"3px", padding:"2px 7px", fontFamily:CP.fontBC, fontSize:"10px", letterSpacing:"0.06em", textTransform:"uppercase", color:"rgba(124,63,187,0.9)", background:"rgba(124,63,187,0.08)", border:`0.5px solid rgba(124,63,187,0.22)` }}>{t}</span>)
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delete modal
// ---------------------------------------------------------------------------
function DeleteModal({ onConfirm, onCancel, deleting, error }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(6,8,16,0.88)", backdropFilter:"blur(4px)", padding:"20px" }}>
      <div style={{ background:CP.surface, border:`0.5px solid ${CP.border}`, borderTop:`2px solid ${CP.red}`, width:"100%", maxWidth:"420px", padding:"28px 26px" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"12px", marginBottom:"18px" }}>
          <div>
            <p style={{ fontFamily:CP.fontBC, fontWeight:900, fontStyle:"italic", fontSize:"24px", textTransform:"uppercase", color:CP.white, letterSpacing:"-0.01em", lineHeight:1, marginBottom:"8px" }}>Delete this scan?</p>
            <p style={{ fontFamily:CP.fontB, fontSize:"13px", color:CP.ghost, lineHeight:1.6 }}>This permanently removes the scan, all matches, and its history from your account.</p>
          </div>
          <button onClick={onCancel} style={{ background:"none", border:"none", cursor:"pointer", color:CP.dim, flexShrink:0, padding:0 }}><X size={16}/></button>
        </div>
        {error && (
          <div style={{ background:"rgba(212,144,10,0.08)", border:`0.5px solid rgba(212,144,10,0.3)`, padding:"10px 14px", marginBottom:"16px", display:"flex", gap:"8px", alignItems:"flex-start" }}>
            <AlertTriangle size={13} style={{ color:CP.amber, flexShrink:0, marginTop:"2px" }} />
            <p style={{ fontFamily:CP.fontB, fontSize:"12px", color:CP.amber }}>{error}</p>
          </div>
        )}
        <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
          <ActionBtn ghost onClick={onCancel} disabled={deleting}>Cancel</ActionBtn>
          <ActionBtn danger onClick={onConfirm} loading={deleting}><Trash2 size={13}/>{deleting?"Deleting…":"Delete Scan"}</ActionBtn>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ScanDetailPage() {
  const router   = useRouter();
  const { user } = useAuthContext();

  const [scan,           setScan]           = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [loadingError,   setLoadingError]   = useState("");
  const [actionError,    setActionError]    = useState("");
  const [reanalyzing,    setReanalyzing]    = useState(false);
  const [shareEnabled,   setShareEnabled]   = useState(false);
  const [shareUrl,       setShareUrl]       = useState("");
  const [shareSaving,    setShareSaving]    = useState(false);
  const [showDeleteModal,setShowDeleteModal]= useState(false);
  const [deleting,       setDeleting]       = useState(false);
  const [isRenaming,     setIsRenaming]     = useState(false);
  const [pendingName,    setPendingName]    = useState("");
  const [renameSaving,   setRenameSaving]   = useState(false);

  const scanId = router.query?.id;

  useEffect(() => {
    if (!router.isReady) return;
    if (!user) { router.push("/login"); return; }
    if (!scanId) return;
    async function loadScan() {
      try {
        setLoading(true); setLoadingError(""); setActionError("");
        const res = await fetch(`/api/getScanDetail?scanId=${scanId}`);
        if (!res.ok) throw new Error((await res.text().catch(()=>""))||`Status ${res.status}`);
        const data = await res.json();
        const s = data.scan||data||null;
        if (!s) throw new Error("Scan not found.");
        setScan(s);
        setShareEnabled(Boolean(s.shareEnabled));
        if (s.shareEnabled&&s.shareToken&&typeof window!=="undefined") setShareUrl(`${window.location.origin}/share/${s.shareToken}`);
        setPendingName(s.name||s.ScanName||"Unnamed Scan");
        try { trackEvent("scan_detail_view",{ eventType:"scan_detail_view", userEmail:user.Email||user.email||"", scanId:s.id }); } catch {}
      } catch (err) { setLoadingError(err.message||"Failed to load scan details."); }
      finally { setLoading(false); }
    }
    loadScan();
  }, [router.isReady, scanId, user, router]);

  useEffect(() => { if (scan) setPendingName(scan.name||scan.ScanName||"Unnamed Scan"); }, [scan]);

  if (!user) return null;

  const counts = useMemo(()=>getCounts(scan),[scan]);
  const risk   = useMemo(()=>computeRiskFromCounts(counts),[counts]);

  const formattedDate = useMemo(()=>{
    if (!scan?.date) return "";
    try { return new Date(scan.date).toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}); }
    catch { return scan.date; }
  },[scan]);

  const bannedRecords     = Array.isArray(scan?.matchedBanned)      ? scan.matchedBanned      : [];
  const ingredientRecords = Array.isArray(scan?.matchedIngredients) ? scan.matchedIngredients : [];

  // Actions
  const handleReanalyze = async ()=>{
    if (!scan?.id) return;
    setReanalyzing(true); setActionError("");
    try {
      const res=await fetch("/api/reanalyzeScan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scanId:scan.id})});
      const data=await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error||"Failed to re-analyze scan.");
      setScan(prev=>({...(prev||{}),...(data.scan||data||{})}));
      try { trackEvent("scan_reanalyzed",{eventType:"scan_reanalyzed",userEmail:user.Email||user.email||"",scanId:scan.id}); } catch {}
    } catch(err){ setActionError(err.message||"Re-analyze failed."); }
    finally { setReanalyzing(false); }
  };

  const handleToggleShare = async ()=>{
    if (!scan?.id) return;
    const next=!shareEnabled; setShareSaving(true); setActionError("");
    try {
      const res=await fetch("/api/shareScan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scanId:scan.id,enable:next})});
      const data=await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error||"Failed to update share settings.");
      const newEnabled=Boolean(data.shareEnabled!==undefined?data.shareEnabled:next);
      const token=data.shareToken||data.token||scan.shareToken;
      setShareEnabled(newEnabled);
      setScan(prev=>prev?{...prev,shareEnabled:newEnabled,shareToken:token}:prev);
      setShareUrl(newEnabled&&token&&typeof window!=="undefined"?`${window.location.origin}/share/${token}`:"");
      try { trackEvent("scan_share_toggle",{eventType:"scan_share_toggle",userEmail:user.Email||user.email||"",scanId:scan.id,enabled:newEnabled}); } catch {}
    } catch(err){ setActionError(err.message||"Failed to update share settings."); }
    finally { setShareSaving(false); }
  };

  const handleConfirmDelete = async ()=>{
    if (!scan?.id) return;
    setDeleting(true); setActionError("");
    try {
      const res=await fetch("/api/deleteScan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scanId:scan.id})});
      const data=await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error||"Failed to delete scan.");
      try { trackEvent("scan_deleted",{eventType:"scan_deleted",userEmail:user.Email||user.email||"",scanId:scan.id}); } catch {}
      router.push("/scans");
    } catch(err){ setActionError(err.message||"Failed to delete scan."); }
    finally { setDeleting(false); setShowDeleteModal(false); }
  };

  const handleSaveRename = async ()=>{
    if (!scan?.id) return;
    const trimmed=String(pendingName||"").trim();
    if (!trimmed) return;
    setRenameSaving(true); setActionError("");
    try {
      const res=await fetch("/api/renameScan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scanId:scan.id,newName:trimmed})});
      const data=await res.json().catch(()=>({}));
      if (!res.ok) throw new Error(data.error||"Failed to rename scan.");
      const updatedName=(data.scan||data).name||(data.scan||data).ScanName||trimmed;
      setScan(prev=>prev?{...prev,name:updatedName}:prev);
      setPendingName(updatedName); setIsRenaming(false);
      try { trackEvent("scan_renamed",{eventType:"scan_renamed",userEmail:user.Email||user.email||"",scanId:scan.id,newName:updatedName}); } catch {}
    } catch(err){ setActionError(err.message||"Failed to rename scan."); }
    finally { setRenameSaving(false); }
  };

  return (
    <>
      <style>{DETAIL_CSS}</style>

      <div style={{ minHeight:"100vh", background:CP.black, color:CP.white, fontFamily:CP.fontB, position:"relative" }}>

        {/* Grain */}
        <div aria-hidden="true" style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, opacity:0.025,
          backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat:"repeat", backgroundSize:"256px" }} />

        {/* Accent line */}
        <div aria-hidden="true" style={{ height:"1px", background:`linear-gradient(90deg,transparent,${CP.accent} 30%,${CP.accent} 70%,transparent)`, opacity:0.25, position:"relative", zIndex:1 }} />

        <div style={{ maxWidth:"1080px", margin:"0 auto", padding:"32px 20px 72px", position:"relative", zIndex:2 }}>

          {/* Back */}
          <button onClick={()=>router.push("/scans")} style={{ display:"inline-flex", alignItems:"center", gap:"8px", fontFamily:CP.fontBC, fontSize:"11px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:CP.dim, background:"none", border:"none", cursor:"pointer", marginBottom:"28px", padding:0 }}>
            <ArrowLeft size={14}/> All Scans
          </button>

          {/* Loading */}
          {loading && <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}><Skeleton height="100px"/><Skeleton height="72px"/><Skeleton height="360px"/></div>}

          {/* Error */}
          {!loading && loadingError && (
            <div style={{ background:CP.surface, border:`0.5px solid ${CP.border}`, borderLeft:`2px solid ${CP.red}`, padding:"32px 24px" }}>
              <p style={{ fontFamily:CP.fontBC, fontWeight:900, fontStyle:"italic", fontSize:"26px", textTransform:"uppercase", color:CP.white, marginBottom:"8px" }}>Something went wrong.</p>
              <p style={{ fontFamily:CP.fontB, fontSize:"13px", color:CP.ghost, marginBottom:"20px" }}>{loadingError}</p>
              <ActionBtn ghost onClick={()=>router.push("/scans")}>← Back to Scans</ActionBtn>
            </div>
          )}

          {/* Not found */}
          {!loading && !loadingError && !scan && (
            <div style={{ background:CP.surface, border:`0.5px solid ${CP.border}`, padding:"32px 24px", textAlign:"center" }}>
              <p style={{ fontFamily:CP.fontBC, fontWeight:900, fontStyle:"italic", fontSize:"26px", textTransform:"uppercase", color:CP.white, marginBottom:"16px" }}>Scan Not Found.</p>
              <ActionBtn onClick={()=>router.push("/scans")}>← Back to Scans</ActionBtn>
            </div>
          )}

          {/* Main */}
          {!loading && !loadingError && scan && (
            <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>

              {/* Header card */}
              <Card accentColor={risk.color}>

                {/* Risk badge */}
                <div style={{ display:"inline-flex", alignItems:"center", gap:"8px", padding:"5px 14px", background:`${risk.color}14`, border:`0.5px solid ${risk.color}44`, marginBottom:"16px" }}>
                  <risk.Icon size={13} style={{ color:risk.color }}/>
                  <span style={{ fontFamily:CP.fontBC, fontSize:"11px", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:risk.color }}>{risk.label}</span>
                  <span style={{ fontFamily:CP.fontB, fontSize:"12px", color:CP.ghost }}>{risk.detail}</span>
                </div>

                {/* Name */}
                {isRenaming ? (
                  <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap", marginBottom:"16px" }}>
                    <input value={pendingName} onChange={e=>setPendingName(e.target.value)} disabled={renameSaving}
                      style={{ fontFamily:CP.fontBC, fontWeight:900, fontSize:"28px", fontStyle:"italic", letterSpacing:"-0.01em", textTransform:"uppercase", color:CP.white, background:CP.raised, border:`0.5px solid rgba(79,171,255,0.4)`, padding:"6px 14px", outline:"none", width:"100%", maxWidth:"460px" }}/>
                    <ActionBtn onClick={handleSaveRename} loading={renameSaving} disabled={renameSaving}><Check size={13}/>{renameSaving?"Saving…":"Save"}</ActionBtn>
                    <ActionBtn ghost onClick={()=>{setIsRenaming(false);setPendingName(scan.name||scan.ScanName||"Unnamed Scan");}} disabled={renameSaving}><X size={13}/>Cancel</ActionBtn>
                  </div>
                ) : (
                  <div style={{ display:"flex", alignItems:"baseline", gap:"12px", flexWrap:"wrap", marginBottom:"16px" }}>
                    <h1 style={{ fontFamily:CP.fontBC, fontWeight:900, fontStyle:"italic", fontSize:"clamp(30px,5vw,52px)", lineHeight:0.9, letterSpacing:"-0.02em", textTransform:"uppercase", color:CP.white, wordBreak:"break-word" }}>
                      {scan.name||scan.ScanName||"Unnamed Scan"}
                    </h1>
                    <button onClick={()=>setIsRenaming(true)} style={{ display:"inline-flex", alignItems:"center", gap:"4px", fontFamily:CP.fontBC, fontSize:"10px", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:CP.dim, background:"none", border:"none", cursor:"pointer", padding:0 }}>
                      <Pencil size={11}/>Rename
                    </button>
                  </div>
                )}

                {/* Meta pills */}
                <div className="sd-meta" style={{ marginBottom:"16px" }}>
                  {formattedDate && <MetaPill><span style={{ width:"6px", height:"6px", borderRadius:"50%", background:CP.green, flexShrink:0 }}/>{formattedDate}</MetaPill>}
                  {scan.userEmail && <MetaPill>{scan.userEmail}</MetaPill>}
                  {scan.source    && <MetaPill>{scan.source}</MetaPill>}
                </div>

                {/* Risk tiles */}
                <div className="sd-tiles" style={{ marginBottom:"16px" }}>
                  {[
                    { label:"Prohibited",  value:counts.prohibitedCount||0, color:CP.red,    sub:null },
                    { label:"Limited",     value:counts.limitedCount   ||0, color:CP.amber,  sub:null },
                    { label:"Other Flags", value:counts.otherCount     ||0, color:CP.purple, sub:"Other banned + matched ingredients" },
                  ].map(({label,value,color,sub})=>(
                    <div key={label} style={{ background:CP.raised, border:`0.5px solid ${CP.border}`, borderTop:`1.5px solid ${color}`, padding:"14px 16px" }}>
                      <p style={{ fontFamily:CP.fontBC, fontSize:"10px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", color:CP.dim, marginBottom:"6px" }}>{label}</p>
                      <p style={{ fontFamily:CP.fontBC, fontWeight:900, fontStyle:"italic", fontSize:"44px", lineHeight:0.85, letterSpacing:"-0.03em", color }}>{value}</p>
                      {sub && <p style={{ fontFamily:CP.fontB, fontSize:"11px", color:CP.dim, marginTop:"6px", lineHeight:1.4 }}>{sub}</p>}
                    </div>
                  ))}
                </div>

                {/* Action bar */}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px", paddingTop:"14px", borderTop:`0.5px solid ${CP.border}` }}>
                  {/* Share toggle */}
                  <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                    <div>
                      <p style={{ fontFamily:CP.fontBC, fontSize:"11px", fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase", color:CP.dim, display:"flex", alignItems:"center", gap:"6px", marginBottom:"2px" }}>
                        <Share2 size={11}/> Shareable Link
                      </p>
                      <p style={{ fontFamily:CP.fontB, fontSize:"11px", color:CP.dim }}>Let others view in read-only mode.</p>
                    </div>
                    <button type="button" onClick={handleToggleShare} disabled={shareSaving} aria-pressed={shareEnabled}
                      style={{ position:"relative", display:"inline-flex", alignItems:"center", width:"44px", height:"24px", borderRadius:"12px", background:shareEnabled?CP.green:CP.raised, border:`0.5px solid ${shareEnabled?CP.green:CP.border}`, cursor:shareSaving?"not-allowed":"pointer", opacity:shareSaving?0.6:1, transition:"background .2s", flexShrink:0 }}>
                      <span style={{ position:"absolute", width:"16px", height:"16px", borderRadius:"50%", background:CP.white, left:shareEnabled?"24px":"4px", transition:"left .2s", boxShadow:"0 1px 4px rgba(0,0,0,0.4)" }}/>
                    </button>
                  </div>

                  <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                    <ActionBtn ghost onClick={handleReanalyze} loading={reanalyzing}>
                      <RefreshCw size={13} className={reanalyzing?"sd-spin":""}/>
                      {reanalyzing?"Re-analyzing…":"Re-analyze"}
                    </ActionBtn>
                    <ActionBtn danger onClick={()=>setShowDeleteModal(true)}>
                      <Trash2 size={13}/> Delete
                    </ActionBtn>
                  </div>
                </div>

                {/* Share URL */}
                {shareEnabled && shareUrl && (
                  <div style={{ background:CP.raised, border:`0.5px solid ${CP.border}`, padding:"12px 16px", display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap", marginTop:"12px" }}>
                    <Link2 size={12} style={{ color:CP.dim, flexShrink:0 }}/>
                    <code style={{ fontFamily:"monospace", fontSize:"12px", color:CP.ghost, flex:1, wordBreak:"break-all" }}>{shareUrl}</code>
                    <button onClick={()=>navigator.clipboard.writeText(shareUrl).catch(()=>{})}
                      style={{ fontFamily:CP.fontBC, fontSize:"11px", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", background:CP.accent, color:CP.black, border:"none", padding:"6px 14px", cursor:"pointer", flexShrink:0 }}>
                      Copy
                    </button>
                  </div>
                )}

                {/* Action error */}
                {actionError && (
                  <div style={{ background:"rgba(212,144,10,0.08)", border:`0.5px solid rgba(212,144,10,0.3)`, padding:"10px 14px", display:"flex", gap:"8px", alignItems:"flex-start", marginTop:"12px" }}>
                    <AlertTriangle size={13} style={{ color:CP.amber, flexShrink:0, marginTop:"2px" }}/>
                    <p style={{ fontFamily:CP.fontB, fontSize:"12px", color:CP.amber }}>{actionError}</p>
                  </div>
                )}
              </Card>

              {/* Tables + sidebar */}
              <div className="sd-grid">
                <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                  <Card accentColor={bannedRecords.length?CP.red:CP.border}>
                    <Eyebrow color={bannedRecords.length?"rgba(217,43,58,0.65)":null}>Banned Substances · {bannedRecords.length}</Eyebrow>
                    <p style={{ fontFamily:CP.fontB, fontSize:"12px", color:CP.dim, marginBottom:"14px" }}>Matched against your banned-substances database.</p>
                    <BannedTable records={bannedRecords}/>
                  </Card>

                  <Card accentColor={ingredientRecords.length?CP.purple:CP.border}>
                    <Eyebrow color={ingredientRecords.length?"rgba(124,63,187,0.65)":null}>Matched Ingredients · {ingredientRecords.length}</Eyebrow>
                    <p style={{ fontFamily:CP.fontB, fontSize:"12px", color:CP.dim, marginBottom:"14px" }}>Pulled from your primary ingredient / SmartStack database.</p>
                    <IngredientsTable records={ingredientRecords}/>
                  </Card>
                </div>

                <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
                  <Card accentColor={CP.border}>
                    <Eyebrow>Raw Ingredients Text</Eyebrow>
                    <p style={{ fontFamily:CP.fontB, fontSize:"12px", color:CP.dim, marginBottom:"12px", lineHeight:1.5 }}>The label text used to match against your databases.</p>
                    {scan.stackDetails||scan.ingredientsText ? (
                      <pre style={{ maxHeight:"280px", overflowY:"auto", background:CP.raised, border:`0.5px solid ${CP.border}`, padding:"14px", fontFamily:"monospace", fontSize:"11px", color:CP.ghost, whiteSpace:"pre-wrap", lineHeight:1.65, margin:0 }}>
                        {scan.stackDetails||scan.ingredientsText}
                      </pre>
                    ) : (
                      <p style={{ fontFamily:CP.fontB, fontSize:"12px", color:CP.dim, fontStyle:"italic" }}>No raw ingredient text stored with this scan.</p>
                    )}
                  </Card>

                  {scan.resultsSummary && (
                    <Card accentColor={CP.border}>
                      <Eyebrow>Results Summary</Eyebrow>
                      <p style={{ fontFamily:CP.fontB, fontSize:"13px", color:CP.ghost, lineHeight:1.7, background:CP.raised, border:`0.5px solid ${CP.border}`, padding:"12px 14px" }}>
                        {scan.resultsSummary}
                      </p>
                    </Card>
                  )}
                </div>
              </div>

              {/* Bottom actions */}
              <div style={{ display:"flex", gap:"10px", paddingTop:"4px" }}>
                <ActionBtn ghost onClick={()=>router.push("/scans")}>← Back to Scans</ActionBtn>
                <ActionBtn onClick={()=>router.push("/nutrition-label-scanner")}>Scan Another Label →</ActionBtn>
              </div>

            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <DeleteModal
          onConfirm={handleConfirmDelete}
          onCancel={()=>setShowDeleteModal(false)}
          deleting={deleting}
          error={actionError}
        />
      )}
    </>
  );
}