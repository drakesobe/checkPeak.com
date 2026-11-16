// components/account/AccountShell.jsx
// Account page wrapper. Coaches get the standard coach-app header (it sits inside the sidebar
// shell); athletes keep the standalone card layout.
"use client";

import { PageHeader, APP } from "@/components/app/ui";

const DS = {
  brand:      "#1E3A5F",
  pageBg:     "#F7F9FC",
  cardBg:     "#FFFFFF",
  border:     "#E8ECF0",
};

export default function AccountShell({ children, coach = false, subtitle = "" }) {
  if (coach) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: APP.canvas, fontFamily: APP.font }}>
        <PageHeader title="Settings & Billing" subtitle={subtitle || "Your profile, team code, plan and password"} />
        <main className="max-w-3xl px-4 py-6 sm:px-7">
          <div className="p-5 sm:p-7" style={{ backgroundColor: APP.surface, border: `1px solid ${APP.line}`, borderRadius: 12 }}>
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: DS.pageBg }}>
      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
        <div
          className="p-6 sm:p-8"
          style={{
            backgroundColor: DS.cardBg,
            border: `1px solid ${DS.border}`,
            borderTop: `4px solid ${DS.brand}`,
            boxShadow: "0 4px 24px rgba(30,58,95,0.07), 0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
