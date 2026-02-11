// components/org/trainers/utils/email.js

export function buildInviteEmail({
  orgName,
  inviterName,
  to,
  role,
  inviteUrl,
  expiresAt,
}) {
  const safeOrg = String(orgName || "Your Organization").trim();
  const safeInviter = String(inviterName || safeOrg).trim();
  const safeTo = String(to || "").trim();

  const roleLower = String(role || "trainer").toLowerCase();
  const isAdmin = roleLower === "admin";
  const roleLabel = isAdmin ? "Head Trainer (Admin)" : "Trainer";

  const subject = `${safeOrg}: Set up your ${roleLabel} access`;

  const expiryLine = expiresAt
    ? `⏳ This setup link expires: ${expiresAt}\n`
    : "";

  const body =
    `Hi${safeTo ? ` ${safeTo.split("@")[0]}` : ""},\n\n` +
    `You’ve been invited by ${safeInviter} to join ${safeOrg} on CheckPeak as a ${roleLabel}.\n\n` +
    `✅ What you’ll be able to do:\n` +
    (isAdmin
      ? `• Manage trainers/admins\n• Review athlete activity and workflow\n• Create and manage plans\n\n`
      : `• Create and manage training plans\n• Review athlete activity (as permitted)\n• Use org tools assigned to your role\n\n`) +
    `🔐 Set your password + activate your account:\n` +
    `${inviteUrl}\n\n` +
    (expiryLine ? `${expiryLine}\n` : "") +
    `If the link doesn’t open, copy/paste it into your browser.\n\n` +
    `Not expecting this invite?\n` +
    `You can ignore this email — no action is required.\n\n` +
    `— ${safeInviter}\n` +
    `${safeOrg}\n`;

  return { to: safeTo, subject, body };
}

export function encodeMailto({ to, subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);

  // NOTE: mailto has practical length limits across clients.
  // Keep body concise if you notice drafts not opening on some devices.
  const qs = params.toString();
  return `mailto:${encodeURIComponent(String(to || "").trim())}${qs ? `?${qs}` : ""}`;
}
