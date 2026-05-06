// components/org/trainers/utils/email.js

function asString(v) {
  return String(v ?? "").trim();
}

function firstNameFromEmail(email = "") {
  const e = asString(email);
  if (!e || !e.includes("@")) return "";
  const left = e.split("@")[0] || "";
  // handle john.doe / john_doe / john-doe nicely
  const parts = left
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return "";
  const name = parts[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function normalizeExpires(expiresAt) {
  // Keep as-provided (you likely already format this upstream)
  // but ensure it is a clean string without extra whitespace.
  return asString(expiresAt);
}

function roleDetails(role) {
  const roleLower = asString(role).toLowerCase();
  const isAdmin = roleLower === "admin";

  return {
    isAdmin,
    roleLabel: isAdmin ? "Head Trainer (Admin)" : "Trainer",
    bullets: isAdmin
      ? [
          "Manage trainers/admins and permissions",
          "Review athlete activity and workflow items",
          "Create and manage plans, workouts, and templates",
          "Keep the org dashboard up to date",
        ]
      : [
          "Create and manage workouts and training plans",
          "Review athlete activity (as permitted by admins)",
          "Use org tools assigned to your role",
          "Support athlete accountability and coaching workflow",
        ],
  };
}

export function buildInviteEmail({ orgName, inviterName, to, role, inviteUrl, expiresAt }) {
  const safeOrg = asString(orgName) || "Your Organization";
  const safeInviter = asString(inviterName) || safeOrg;

  const safeTo = asString(to);
  const safeUrl = asString(inviteUrl);

  const { isAdmin, roleLabel, bullets } = roleDetails(role);

  const firstName = firstNameFromEmail(safeTo);
  const greet = firstName ? `Hi ${firstName},` : "Hi there,";

  const subject = `${safeOrg}: Set up your ${roleLabel} access`;

  const exp = normalizeExpires(expiresAt);
  const expiryBlock = exp
    ? [
        "⏳ Time sensitive:",
        `This setup link expires on: ${exp}`,
        "",
      ].join("\n")
    : "";

  const bodyLines = [
    greet,
    "",
    `You’ve been invited by ${safeInviter} to join ${safeOrg} on CheckPeak as a ${roleLabel}.`,
    "",
    "✅ What you’ll be able to do:",
    ...bullets.map((b) => `• ${b}`),
    "",
    "🔐 Set your password + activate your account:",
    safeUrl || "(setup link missing)",
    "",
    expiryBlock ? expiryBlock.trimEnd() : null,
    expiryBlock ? "" : null,
    "Quick notes:",
    "• If the link doesn’t open when tapped, copy/paste it into your browser.",
    "• If your email app truncates the link, try opening it on desktop or paste into Safari/Chrome.",
    "",
    isAdmin
      ? "As an Admin, you’ll have additional access to manage team members and org-level settings."
      : "As a Trainer, your access is scoped to training tools and permitted athlete workflows.",
    "",
    "Not expecting this invite?",
    "You can ignore this email - no action is required, and your access will not be activated.",
    "",
    `- ${safeInviter}`,
    safeOrg,
  ].filter((x) => x !== null);

  return { to: safeTo, subject, body: bodyLines.join("\n") };
}

export function encodeMailto({ to, subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);

  // NOTE: mailto has practical length limits across clients.
  // Keep body concise if you notice drafts not opening on some devices.
  const qs = params.toString();
  return `mailto:${encodeURIComponent(asString(to))}${qs ? `?${qs}` : ""}`;
}