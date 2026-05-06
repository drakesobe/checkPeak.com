// components/org/athletes/AthleteImportModal.jsx
// Bulk athlete import via CSV or Excel.
// Flow: upload → parse client-side → preview + fix errors → confirm → API → summary
"use client";

import { useCallback, useRef, useState, useMemo } from "react";
import {
  X, Upload, Download, CheckCircle2, AlertTriangle,
  Info, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";

// ─── Column config ────────────────────────────────────────────────────────────
// Maps friendly header names → internal field keys.
// Case-insensitive, strips whitespace.
const COLUMN_ALIASES = {
  firstname:   "firstName",
  "first name":"firstName",
  first:       "firstName",
  lastname:    "lastName",
  "last name": "lastName",
  last:        "lastName",
  email:       "email",
  "e-mail":    "email",
  emailaddress:"email",
  sport:       "sport",
  team:        "sport",
  phone:       "phone",
  phonenumber: "phone",
  "phone number":"phone",
  mobile:      "phone",
  cell:        "phone",
};

const REQUIRED_FIELDS = ["firstName", "lastName", "email"];
const SPORT_OPTIONS   = ["soccer","basketball","xc","football","track","swim","tennis","hockey","baseball","softball","wrestling"];

// ─── Template CSV ─────────────────────────────────────────────────────────────
const TEMPLATE_CSV = `First Name,Last Name,Email,Sport,Phone Number
Jane,Smith,jsmith@university.edu,soccer,555-000-0001
John,Doe,jdoe@university.edu,basketball,555-000-0002`;

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "checkpeak-athlete-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────
function normalizeHeader(h) {
  return String(h || "").toLowerCase().replace(/[^a-z ]/g, "").trim();
}

function buildHeaderMap(headers) {
  const map = {}; // fieldKey → colIndex
  headers.forEach((h, i) => {
    const norm = normalizeHeader(h);
    const key  = COLUMN_ALIASES[norm];
    if (key && !(key in map)) map[key] = i;
  });
  return map;
}

function parseCSV(text) {
  // Simple but robust: handles quoted fields, CRLF and LF
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows  = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const row = [];
    let cur = "", inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i+1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        row.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

async function parseExcel(file) {
  // Dynamically import xlsx only when needed
  const XLSX = await import("xlsx");
  const ab   = await file.arrayBuffer();
  const wb   = XLSX.read(ab, { type: "array" });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
  return rows.map(r => r.map(String));
}

function validateEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());
}

function rowToAthlete(row, headerMap, rowIndex) {
  const get = key => String(row[headerMap[key]] || "").trim();
  const firstName = get("firstName");
  const lastName  = get("lastName");
  const email     = get("email").toLowerCase();
  const sport     = get("sport").toLowerCase();
  const phone     = get("phone");

  const errors = [];
  if (!firstName)        errors.push("Missing first name");
  if (!lastName)         errors.push("Missing last name");
  if (!email)            errors.push("Missing email");
  else if (!validateEmail(email)) errors.push("Invalid email format");
  if (sport && !SPORT_OPTIONS.includes(sport)) errors.push(`Unknown sport "${sport}" - will still be saved`);

  return {
    _rowIndex: rowIndex,
    firstName, lastName,
    email, sport, phone,
    name: `${firstName} ${lastName}`.trim(),
    errors,
    status: errors.filter(e => !e.includes("Unknown sport")).length > 0 ? "error" : "ready",
  };
}

async function parseFile(file) {
  let rawRows;
  if (file.name.endsWith(".csv") || file.type === "text/csv") {
    const text = await file.text();
    rawRows = parseCSV(text);
  } else {
    rawRows = await parseExcel(file);
  }
  if (rawRows.length < 2) throw new Error("File appears to be empty or has no data rows.");
  const headers   = rawRows[0];
  const headerMap = buildHeaderMap(headers);
  const missing   = REQUIRED_FIELDS.filter(f => !(f in headerMap));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}. Check your column headers match the template.`);
  const athletes = rawRows.slice(1)
    .filter(r => r.some(c => String(c).trim()))
    .map((r, i) => rowToAthlete(r, headerMap, i + 2));
  return athletes;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status, errors }) {
  if (status === "error") return (
    <span style={{ fontSize: 11, fontWeight: 700, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap" }}>
      ✗ {errors[0]}
    </span>
  );
  if (status === "duplicate") return (
    <span style={{ fontSize: 11, fontWeight: 700, background: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A", borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap" }}>
      ⚠ Duplicate
    </span>
  );
  return (
    <span style={{ fontSize: 11, fontWeight: 700, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap" }}>
      ✓ Ready
    </span>
  );
}

function InlineEdit({ value, onChange, placeholder, invalid }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "4px 8px", fontSize: 12,
        border: `1px solid ${invalid ? "#FECACA" : "#E5E7EB"}`,
        borderRadius: 4, background: invalid ? "#FEF9F9" : "#fff",
        color: "#1A2535", outline: "none",
      }}
    />
  );
}

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────
export default function AthleteImportModal({ open, onClose, onImported }) {
  const fileRef   = useRef(null);
  const [step,    setStep]    = useState("upload");   // upload | preview | importing | done
  const [parsing, setParsing] = useState(false);
  const [parseErr,setParseErr]= useState("");
  const [rows,    setRows]    = useState([]);          // parsed athlete rows
  const [result,  setResult]  = useState(null);        // { created, skipped, errors }
  const [showErrors, setShowErrors] = useState(false);
  const [dragging,   setDragging]   = useState(false);

  const errorRows    = rows.filter(r => r.status === "error");
  const duplicateRows= rows.filter(r => r.status === "duplicate");
  const readyRows    = rows.filter(r => r.status === "ready");

  // De-dup within the upload itself
  function markDuplicates(athletes) {
    const seen = new Set();
    return athletes.map(a => {
      if (!a.email) return a;
      if (seen.has(a.email)) return { ...a, status: "duplicate", errors: ["Duplicate email in file"] };
      seen.add(a.email);
      return a;
    });
  }

  async function handleFile(file) {
    if (!file) return;
    const allowed = [".csv", ".xlsx", ".xls", "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"];
    const ok = allowed.some(a => file.name.endsWith(a.replace(".", ".")) || file.type === a);
    if (!ok) { setParseErr("Please upload a CSV or Excel file (.csv, .xlsx, .xls)."); return; }
    setParsing(true); setParseErr("");
    try {
      const athletes = markDuplicates(await parseFile(file));
      setRows(athletes);
      setStep("preview");
    } catch (e) {
      setParseErr(e.message || "Failed to parse file.");
    } finally {
      setParsing(false);
    }
  }

  function updateRow(rowIndex, field, value) {
    setRows(prev => prev.map(r => {
      if (r._rowIndex !== rowIndex) return r;
      const updated = { ...r, [field]: value };
      // Recompute name if name parts changed
      if (field === "firstName" || field === "lastName") {
        updated.name = `${updated.firstName} ${updated.lastName}`.trim();
      }
      // Revalidate
      const errors = [];
      if (!updated.firstName.trim()) errors.push("Missing first name");
      if (!updated.lastName.trim())  errors.push("Missing last name");
      if (!updated.email.trim())     errors.push("Missing email");
      else if (!validateEmail(updated.email)) errors.push("Invalid email format");
      updated.errors = errors;
      updated.status = errors.length > 0 ? "error" : "ready";
      return updated;
    }));
  }

  async function handleImport() {
    const toImport = rows.filter(r => r.status === "ready");
    if (!toImport.length) return;
    setStep("importing");
    try {
      const res  = await fetch("/api/org/athlete/bulk-import", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athletes: toImport.map(a => ({
            firstName: a.firstName.trim(),
            lastName:  a.lastName.trim(),
            email:     a.email.trim().toLowerCase(),
            sport:     a.sport || "",
            phone:     a.phone || "",
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Import failed");
      setResult(data);
      setStep("done");
      onImported?.();
    } catch (e) {
      setParseErr(e.message || "Import failed. Try again.");
      setStep("preview");
    }
  }

  function reset() {
    setStep("upload"); setRows([]); setResult(null);
    setParseErr(""); setParsing(false); setShowErrors(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() { reset(); onClose?.(); }

  if (!open) return null;

  // ── STYLES ──────────────────────────────────────────────────────────────────
  const overlay = {
    position: "fixed", inset: 0, zIndex: 10000,
    background: "rgba(0,0,0,0.45)", display: "flex",
    alignItems: "center", justifyContent: "center",
    padding: "16px",
  };
  const modal = {
    width: "100%", maxWidth: 780, background: "#fff",
    border: "1px solid #E8ECF0", borderTop: "3px solid #1A6FE8",
    maxHeight: "calc(100dvh - 32px)", display: "flex",
    flexDirection: "column", borderRadius: 2,
  };
  const header = {
    padding: "16px 20px", borderBottom: "1px solid #E8ECF0",
    background: "#F8FAFC", display: "flex",
    alignItems: "flex-start", justifyContent: "space-between", gap: 16,
    flexShrink: 0,
  };
  const body = { overflowY: "auto", flex: 1, padding: "20px" };
  const label = {
    fontSize: 11, fontWeight: 900, textTransform: "uppercase",
    letterSpacing: "0.06em", color: "#6B7A8D", display: "block", marginBottom: 6,
  };
  const colHeader = {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.06em", color: "#6B7A8D", padding: "8px 10px",
    background: "#F8FAFC", borderBottom: "1px solid #E8ECF0",
  };

  return (
    <div style={overlay} onClick={handleClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        {/* ── HEADER ── */}
        <div style={header}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 900, color: "#1A2535", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              {step === "done" ? "Import complete" : "Import Athletes"}
            </p>
            <p style={{ fontSize: 11, color: "#6B7A8D", marginTop: 3 }}>
              {step === "upload"    && "Upload a CSV or Excel file to add athletes in bulk."}
              {step === "preview"   && `${rows.length} rows detected - review before importing.`}
              {step === "importing" && "Creating athlete accounts…"}
              {step === "done"      && `${result?.created ?? 0} athletes added to your roster.`}
            </p>
          </div>
          <button onClick={handleClose} style={{ padding: 6, border: "1px solid #E8ECF0", background: "#fff", cursor: "pointer", borderRadius: 4 }}>
            <X size={15} color="#6B7A8D" />
          </button>
        </div>

        <div style={body}>

          {/* ── STEP: UPLOAD ── */}
          {step === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

              {/* Instructions */}
              <div style={{ padding: "14px 16px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderLeft: "3px solid #1A6FE8", display: "flex", gap: 10 }}>
                <Info size={15} color="#1A6FE8" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: "#1E40AF", lineHeight: 1.7 }}>
                  <strong>Required columns:</strong> First Name, Last Name, Email<br />
                  <strong>Optional columns:</strong> Sport, Phone Number<br />
                  Column headers must match exactly - download the template below to be safe.
                </div>
              </div>

              {/* Template download */}
              <button
                onClick={downloadTemplate}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", background: "#F8FAFC", border: "1px solid #E8ECF0", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#1A2535", width: "fit-content" }}
              >
                <Download size={14} /> Download template CSV
              </button>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
                onClick={() => fileRef.current?.click()}
                style={{
                  border: `2px dashed ${dragging ? "#1A6FE8" : "#CBD5E1"}`,
                  borderRadius: 8, padding: "48px 24px", textAlign: "center",
                  cursor: "pointer", background: dragging ? "#EFF6FF" : "#FAFBFC",
                  transition: "all 0.15s",
                }}
              >
                {parsing ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <Loader2 size={28} color="#1A6FE8" style={{ animation: "spin 1s linear infinite" }} />
                    <span style={{ fontSize: 13, color: "#6B7A8D" }}>Parsing file…</span>
                  </div>
                ) : (
                  <>
                    <Upload size={28} color="#94A3B8" style={{ margin: "0 auto 12px" }} />
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#1A2535", marginBottom: 6 }}>
                      Drop your file here, or click to browse
                    </p>
                    <p style={{ fontSize: 12, color: "#94A3B8" }}>CSV, XLSX or XLS - up to 1,000 athletes</p>
                  </>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                style={{ display: "none" }}
                onChange={e => handleFile(e.target.files?.[0])}
              />

              {parseErr && (
                <div style={{ padding: "12px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <AlertTriangle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#DC2626", fontWeight: 600 }}>{parseErr}</span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === "preview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Summary bar */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, background: "#F0FDF4", color: "#16A34A", border: "1px solid #BBF7D0", borderRadius: 4, padding: "4px 10px" }}>
                  ✓ {readyRows.length} ready
                </span>
                {duplicateRows.length > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, background: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A", borderRadius: 4, padding: "4px 10px" }}>
                    ⚠ {duplicateRows.length} duplicate{duplicateRows.length !== 1 ? "s" : ""}
                  </span>
                )}
                {errorRows.length > 0 && (
                  <span style={{ fontSize: 12, fontWeight: 700, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 4, padding: "4px 10px" }}>
                    ✗ {errorRows.length} error{errorRows.length !== 1 ? "s" : ""}
                  </span>
                )}
                {(errorRows.length > 0 || duplicateRows.length > 0) && (
                  <span style={{ fontSize: 12, color: "#6B7A8D", padding: "4px 0" }}>
                    - Rows with errors and duplicates will be skipped. Fix them inline or proceed.
                  </span>
                )}
              </div>

              {parseErr && (
                <div style={{ padding: "12px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, display: "flex", gap: 8 }}>
                  <AlertTriangle size={14} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#DC2626", fontWeight: 600 }}>{parseErr}</span>
                </div>
              )}

              {/* Table */}
              <div style={{ border: "1px solid #E8ECF0", borderRadius: 6, overflow: "hidden" }}>
                <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                      <tr>
                        <th style={{ ...colHeader, width: 32 }}>#</th>
                        <th style={{ ...colHeader, minWidth: 110 }}>First Name</th>
                        <th style={{ ...colHeader, minWidth: 110 }}>Last Name</th>
                        <th style={{ ...colHeader, minWidth: 180 }}>Email</th>
                        <th style={{ ...colHeader, minWidth: 100 }}>Sport</th>
                        <th style={{ ...colHeader, minWidth: 120 }}>Phone</th>
                        <th style={{ ...colHeader, minWidth: 100 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={r._rowIndex} style={{ borderBottom: "1px solid #F1F5F9", background: r.status === "error" ? "#FFFAFA" : r.status === "duplicate" ? "#FFFDF0" : "#fff" }}>
                          <td style={{ padding: "6px 10px", color: "#94A3B8", fontSize: 11, textAlign: "center" }}>{r._rowIndex}</td>
                          <td style={{ padding: "6px 6px" }}>
                            <InlineEdit
                              value={r.firstName}
                              onChange={v => updateRow(r._rowIndex, "firstName", v)}
                              placeholder="First name"
                              invalid={!r.firstName.trim()}
                            />
                          </td>
                          <td style={{ padding: "6px 6px" }}>
                            <InlineEdit
                              value={r.lastName}
                              onChange={v => updateRow(r._rowIndex, "lastName", v)}
                              placeholder="Last name"
                              invalid={!r.lastName.trim()}
                            />
                          </td>
                          <td style={{ padding: "6px 6px" }}>
                            <InlineEdit
                              value={r.email}
                              onChange={v => updateRow(r._rowIndex, "email", v.toLowerCase())}
                              placeholder="email@school.edu"
                              invalid={!r.email.trim() || !validateEmail(r.email)}
                            />
                          </td>
                          <td style={{ padding: "6px 6px" }}>
                            <select
                              value={r.sport || ""}
                              onChange={e => updateRow(r._rowIndex, "sport", e.target.value)}
                              style={{ width: "100%", padding: "4px 6px", fontSize: 12, border: "1px solid #E5E7EB", borderRadius: 4, background: "#fff", color: "#1A2535" }}
                            >
                              <option value="">- none -</option>
                              {SPORT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: "6px 6px" }}>
                            <InlineEdit
                              value={r.phone}
                              onChange={v => updateRow(r._rowIndex, "phone", v)}
                              placeholder="Optional"
                            />
                          </td>
                          <td style={{ padding: "6px 10px" }}>
                            <StatusBadge status={r.status} errors={r.errors} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, paddingTop: 4 }}>
                <button onClick={reset} style={{ padding: "9px 16px", background: "#fff", border: "1px solid #E8ECF0", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#6B7A8D" }}>
                  ← Upload different file
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {readyRows.length === 0 && (
                    <span style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>Fix errors before importing</span>
                  )}
                  <button
                    onClick={handleImport}
                    disabled={readyRows.length === 0}
                    style={{
                      padding: "9px 20px", background: readyRows.length === 0 ? "#E8ECF0" : "#1A6FE8",
                      border: "none", borderRadius: 6, cursor: readyRows.length === 0 ? "not-allowed" : "pointer",
                      fontSize: 13, fontWeight: 900, color: readyRows.length === 0 ? "#94A3B8" : "#fff",
                      letterSpacing: "0.04em", textTransform: "uppercase",
                    }}
                  >
                    Import {readyRows.length} athlete{readyRows.length !== 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: IMPORTING ── */}
          {step === "importing" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "48px 0" }}>
              <Loader2 size={36} color="#1A6FE8" style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: "#1A2535" }}>Creating athlete accounts…</p>
              <p style={{ fontSize: 13, color: "#6B7A8D" }}>This may take a moment for large rosters.</p>
            </div>
          )}

          {/* ── STEP: DONE ── */}
          {step === "done" && result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 0 16px" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F0FDF4", border: "2px solid #BBF7D0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 size={26} color="#16A34A" />
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "#1A2535", letterSpacing: "-0.3px" }}>Import complete</p>
              </div>

              {/* Result summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {[
                  { label: "Created",   value: result.created ?? 0, color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
                  { label: "Skipped",   value: result.skipped ?? 0, color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
                  { label: "Errors",    value: result.errors?.length ?? 0, color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
                ].map(({ label, value, color, bg, border }) => (
                  <div key={label} style={{ textAlign: "center", padding: "16px", background: bg, border: `1px solid ${border}`, borderRadius: 8 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Error details */}
              {result.errors?.length > 0 && (
                <div style={{ border: "1px solid #FECACA", borderRadius: 6, overflow: "hidden" }}>
                  <button
                    onClick={() => setShowErrors(v => !v)}
                    style={{ width: "100%", padding: "10px 14px", background: "#FEF2F2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#DC2626" }}
                  >
                    <span>View {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}</span>
                    {showErrors ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {showErrors && (
                    <ul style={{ margin: 0, padding: "8px 14px 12px", listStyle: "none" }}>
                      {result.errors.map((e, i) => (
                        <li key={i} style={{ fontSize: 12, color: "#991B1B", padding: "4px 0", borderBottom: i < result.errors.length - 1 ? "1px solid #FEE2E2" : "none" }}>
                          {e.email} - {e.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                {result.skipped > 0 && (
                  <button onClick={reset} style={{ padding: "9px 16px", background: "#fff", border: "1px solid #E8ECF0", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#6B7A8D" }}>
                    Import another file
                  </button>
                )}
                <button onClick={handleClose} style={{ padding: "9px 20px", background: "#1A6FE8", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 900, color: "#fff", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}