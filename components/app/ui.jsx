// components/app/ui.jsx
// Shared look for the coach app: tokens, page header, buttons. Every in-app page header should use
// PageHeader so titles, actions and toolbars look and behave the same everywhere.
"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

export const APP = {
  ink:        "#0F172A",
  text:       "#334155",
  muted:      "#64748B",
  faint:      "#94A3B8",
  line:       "#E5E7EB",
  lineSoft:   "#F1F5F9",
  surface:    "#FFFFFF",
  canvas:     "#F7F8FA",
  brand:      "#1E3A5F",
  brandHover: "#162D4A",
  brandTint:  "rgba(30,58,95,0.07)",
  danger:     "#B91C1C",
  dangerTint: "#FEF2F2",
  font:       "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

export const APP_STYLE = `
  .app-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; height: 36px; padding: 0 14px;
    border-radius: 8px; font: 600 14px/1 ${APP.font}; white-space: nowrap; cursor: pointer;
    transition: background-color 0.12s, border-color 0.12s, color 0.12s, box-shadow 0.12s; }
  .app-btn:focus-visible, .app-icon-btn:focus-visible, .app-seg button:focus-visible { outline: 2px solid ${APP.brand}; outline-offset: 2px; }
  .app-btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .app-btn--primary { background: ${APP.brand}; color: #fff; border: 1px solid ${APP.brand}; box-shadow: 0 1px 2px rgba(15,23,42,0.12); }
  .app-btn--primary:hover:not(:disabled) { background: ${APP.brandHover}; border-color: ${APP.brandHover}; }
  .app-btn--secondary { background: #fff; color: ${APP.ink}; border: 1px solid ${APP.line}; box-shadow: 0 1px 2px rgba(15,23,42,0.04); }
  .app-btn--secondary:hover:not(:disabled) { background: #F8FAFC; border-color: #D5DAE1; }
  .app-btn--secondary.is-on { background: ${APP.brandTint}; border-color: rgba(30,58,95,0.25); color: ${APP.brand}; }
  .app-btn--ghost { background: transparent; color: ${APP.text}; border: 1px solid transparent; }
  .app-btn--ghost:hover:not(:disabled) { background: ${APP.lineSoft}; color: ${APP.ink}; }
  .app-btn-count { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; display: inline-flex; align-items: center;
    justify-content: center; font-size: 11px; font-weight: 700; background: ${APP.brand}; color: #fff; }

  .app-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px;
    border: 1px solid ${APP.line}; background: #fff; color: ${APP.text}; cursor: pointer; }
  .app-icon-btn:hover { background: #F8FAFC; color: ${APP.ink}; }

  .app-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 9px; background: ${APP.lineSoft}; border: 1px solid ${APP.line}; }
  .app-seg button { height: 28px; padding: 0 12px; border: none; border-radius: 6px; background: transparent; color: ${APP.muted};
    font: 600 13px/1 ${APP.font}; cursor: pointer; }
  .app-seg button[aria-pressed="true"] { background: #fff; color: ${APP.ink}; box-shadow: 0 1px 2px rgba(15,23,42,0.1); }

  .app-ph { background: ${APP.surface}; border-bottom: 1px solid ${APP.line}; padding: 16px 16px 12px; font-family: ${APP.font}; }
  @media (min-width: 700px) { .app-ph { padding: 22px 28px 14px; } }
  .app-ph-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .app-ph-title { margin: 0; font-size: 22px; line-height: 1.2; font-weight: 700; letter-spacing: -0.015em; color: ${APP.ink}; }
  @media (min-width: 700px) { .app-ph-title { font-size: 24px; } }
  .app-ph-sub { margin: 4px 0 0; font-size: 14px; line-height: 1.45; color: ${APP.muted}; }
  .app-ph-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .app-ph-secondary { display: none; gap: 8px; }
  @media (min-width: 900px) { .app-ph-secondary { display: flex; } .app-ph-overflow { display: none; } }
  .app-ph-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-top: 14px; }

  .app-menu { position: absolute; right: 0; top: calc(100% + 6px); min-width: 210px; padding: 6px; z-index: 60;
    background: #fff; border: 1px solid ${APP.line}; border-radius: 10px; box-shadow: 0 12px 32px rgba(15,23,42,0.14); }
  .app-menu button { width: 100%; display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 10px; border: none;
    border-radius: 7px; background: none; color: ${APP.ink}; font: 500 14px/1 ${APP.font}; cursor: pointer; text-align: left; }
  .app-menu button:hover { background: ${APP.lineSoft}; }
  .app-menu button.is-on { color: ${APP.brand}; font-weight: 700; }
`;

// action: { label, icon: LucideIcon, onClick, active?, count? }
export function AppButton({ action, variant = "secondary", className = "" }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      aria-pressed={action.active === undefined ? undefined : !!action.active}
      className={`app-btn app-btn--${variant}${action.active ? " is-on" : ""} ${className}`}
    >
      {Icon && <Icon size={16} strokeWidth={2} aria-hidden="true" />}
      {action.label}
      {action.count > 0 && <span className="app-btn-count">{action.count}</span>}
    </button>
  );
}

function OverflowMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} className="app-ph-overflow" style={{ position: "relative" }}>
      <button type="button" className="app-icon-btn" aria-label="More actions" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="app-menu" role="menu">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.label} type="button" role="menuitem" className={a.active ? "is-on" : ""} onClick={() => { setOpen(false); a.onClick?.(); }}>
                {Icon && <Icon size={16} aria-hidden="true" />}
                <span style={{ flex: 1 }}>{a.label}</span>
                {a.count > 0 && <span className="app-btn-count">{a.count}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Page header used on every coach page.
// secondaryActions fold into a "•••" menu on narrow screens; the primary action always stays visible.
export function PageHeader({ title, subtitle, primaryAction, secondaryActions = [], toolbar, children }) {
  return (
    <header className="app-ph">
      <style>{APP_STYLE}</style>
      <div className="app-ph-row">
        <div style={{ minWidth: 0 }}>
          <h1 className="app-ph-title">{title}</h1>
          {subtitle && <p className="app-ph-sub">{subtitle}</p>}
        </div>
        {(primaryAction || secondaryActions.length > 0) && (
          <div className="app-ph-actions">
            {secondaryActions.length > 0 && (
              <>
                <div className="app-ph-secondary">
                  {secondaryActions.map((a) => <AppButton key={a.label} action={a} variant="secondary" />)}
                </div>
                <OverflowMenu actions={secondaryActions} />
              </>
            )}
            {primaryAction && <AppButton action={primaryAction} variant="primary" />}
          </div>
        )}
      </div>
      {toolbar && <div className="app-ph-toolbar">{toolbar}</div>}
      {children}
    </header>
  );
}
