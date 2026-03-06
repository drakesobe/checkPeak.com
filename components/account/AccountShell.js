// components/account/AccountShell.jsx
"use client";

const DS = {
  brand:      "#1E3A5F",
  pageBg:     "#F7F9FC",
  cardBg:     "#FFFFFF",
  border:     "#E8ECF0",
  brandBorder:"#C0D0E0",
};

export default function AccountShell({ children }) {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: DS.pageBg }}
    >
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