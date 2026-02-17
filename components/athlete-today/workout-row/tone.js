import { cx } from "./helpers";

export function getRowState({ status, completedFlag }) {
  const s = String(status || "").trim().toLowerCase();
  const isPending = s === "pending_review";
  const isRejected = s === "rejected";
  const isCompleted = s === "completed" || Boolean(completedFlag);
  const isCheckedOff = (isCompleted || isPending) && !isRejected;

  return { isPending, isRejected, isCompleted, isCheckedOff };
}

export function getTone({
  isRejected,
  isPending,
  isCompleted,
  isCheckedOff,
  evidenceRequired,
}) {
  // 1) Decide tone by priority
  const cardTone = isRejected
    ? "rejected"
    : isCompleted
    ? "completed"
    : isPending
    ? "pending"
    : "base";

  // 2) Card styles
  const toneCardCls =
    cardTone === "rejected"
      ? "border-amber-200 bg-amber-50/70"
      : cardTone === "pending"
      ? "border-sky-200 bg-sky-50/65"
      : cardTone === "completed"
      ? "border-emerald-200 bg-emerald-50/65"
      : "border-gray-200 bg-white hover:border-gray-300";

  // 3) Icon well styles
  const toneIconWrap =
    cardTone === "rejected"
      ? "border-amber-200 bg-amber-100"
      : cardTone === "pending"
      ? "border-sky-200 bg-sky-100"
      : cardTone === "completed"
      ? "border-emerald-200 bg-emerald-100"
      : evidenceRequired
      ? "border-amber-200 bg-amber-50"
      : "border-blue-100 bg-blue-50";

  // 4) Link styles
  const linkTone =
    cardTone === "rejected"
      ? "text-amber-800"
      : cardTone === "pending"
      ? "text-sky-800"
      : cardTone === "completed"
      ? "text-emerald-800"
      : "text-[#46769B]";

  // 5) Swipe rail theme
  // pending => sky (so it “feels done but in review”)
  // completed => emerald
  // rejected => gray (or amber if you want it louder)
  const railTone =
    cardTone === "completed"
      ? "emerald"
      : cardTone === "pending"
      ? "sky"
      : cardTone === "rejected"
      ? "gray"
      : "blue";

  // 6) Hint line color
  const hintToneText =
    cardTone === "rejected"
      ? "text-amber-900/80"
      : cardTone === "pending"
      ? "text-sky-900/80"
      : cardTone === "completed"
      ? "text-emerald-900/80"
      : "text-gray-500";

  // 7) Optional: a subtle ring for checked-off states (helps “it worked” feeling)
  const ringCls = isCheckedOff
    ? cardTone === "pending"
      ? "ring-1 ring-sky-200/60"
      : "ring-1 ring-emerald-200/60"
    : "ring-0";

  return {
    cardTone,
    toneCardCls,
    toneIconWrap,
    linkTone,
    railTone,
    hintToneText,
    ringCls,
    sheenBg: cx("bg-white/45"),
  };
}
