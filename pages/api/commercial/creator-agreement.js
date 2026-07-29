import { getRequestUser } from "@/lib/commercial/getRequestUser";
import {
  getTrainerByUserId,
  getCreatorAgreementByTrainer,
  getCreatorAgreementByCode,
  createCreatorAgreement,
  updateCreatorAgreementCode,
  getCreatorReferralCount,
} from "@/lib/commercial/db";

export default async function handler(req, res) {
  const user = getRequestUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const trainer = await getTrainerByUserId(user.email || user.Email);
  if (!trainer) return res.status(404).json({ error: "Trainer not found" });

  if (req.method === "GET") {
    const agreement = await getCreatorAgreementByTrainer(trainer.id);
    const referralCount = agreement
      ? await getCreatorReferralCount(agreement.fields?.creatorCode)
      : 0;
    return res.status(200).json({ agreement: agreement ?? null, referralCount });
  }

  if (req.method === "POST") {
    const { legalName, creatorCode: rawCode } = req.body ?? {};
    if (!legalName?.trim()) return res.status(400).json({ error: "Legal name is required" });

    const creatorCode = String(rawCode ?? "").toUpperCase().trim();
    if (!/^CP-[A-Z0-9]{3,12}$/.test(creatorCode)) {
      return res.status(400).json({ error: "Code must start with CP- followed by 3–12 letters or numbers (e.g. CP-YOURNAME)." });
    }

    // Already signed — return their existing record
    const existing = await getCreatorAgreementByTrainer(trainer.id);
    if (existing) return res.status(409).json({ agreement: existing });

    // Check uniqueness
    const taken = await getCreatorAgreementByCode(creatorCode);
    if (taken) return res.status(409).json({ error: "That code is already taken. Please choose another." });

    const email = trainer.fields?.email ?? user.email ?? user.Email ?? "";

    const agreement = await createCreatorAgreement({
      trainerId:   trainer.id,
      legalName:   legalName.trim(),
      email,
      creatorCode,
      signedAt:    new Date().toISOString(),
    });

    if (agreement?.error) return res.status(500).json({ error: "Failed to save agreement. Please try again." });
    return res.status(201).json({ agreement });
  }

  if (req.method === "PUT") {
    const { creatorCode: rawCode } = req.body ?? {};
    const creatorCode = String(rawCode ?? "").toUpperCase().trim();
    if (!/^CP-[A-Z0-9]{3,12}$/.test(creatorCode)) {
      return res.status(400).json({ error: "Code must start with CP- followed by 3–12 letters or numbers." });
    }

    const existing = await getCreatorAgreementByTrainer(trainer.id);
    if (!existing) return res.status(404).json({ error: "No signed agreement found." });

    // 6-month cooldown — measured from last change or original signing date
    const lastChanged = existing.fields?.codeChangedAt ?? existing.fields?.signedAt;
    if (lastChanged) {
      const nextAllowed = new Date(lastChanged);
      nextAllowed.setMonth(nextAllowed.getMonth() + 6);
      if (new Date() < nextAllowed) {
        const label = nextAllowed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
        return res.status(429).json({
          error: `Codes can only be changed once every 6 months. Your next change is available on ${label}.`,
          nextAllowed: nextAllowed.toISOString(),
        });
      }
    }

    // Uniqueness — make sure nobody else has this code
    const taken = await getCreatorAgreementByCode(creatorCode);
    if (taken && taken.id !== existing.id) {
      return res.status(409).json({ error: "That code is already taken. Please choose another." });
    }

    const updated = await updateCreatorAgreementCode(trainer.id, creatorCode);
    if (updated?.error) return res.status(500).json({ error: "Failed to update code." });
    return res.status(200).json({ agreement: updated });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
