// components/athlete-today/complete-item-modal/components/Card.jsx

"use client";
import { classNames } from "../../ui";

export default function Card({ children, className = "" }) {
  return (
    <div
      className={classNames(
        "rounded-2xl border border-gray-200 bg-white p-4",
        className
      )}
    >
      {children}
    </div>
  );
}
