// components/org/reviewQueue/table/AckPill.jsx
"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { Pill } from "@/components/org/reviewQueue/ui";

export default function AckPill({ ack }) {
  if (ack) {
    return (
      <Pill tone="ok">
        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
        Acknowledged
      </Pill>
    );
  }
  return (
    <Pill tone="warn">
      <Clock className="w-3.5 h-3.5 mr-1.5" />
      Not acknowledged
    </Pill>
  );
}
