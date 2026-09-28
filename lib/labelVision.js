// lib/labelVision.js
// Reads supplement / nutrition label photos with Claude vision and returns structured data.
// Claude only READS the label. Whether anything is banned is decided by lib/supplementMatching.js
// against the curated database, never by the model.

import Anthropic from "@anthropic-ai/sdk";

// Sonnet reads dense, small label print far more reliably than Haiku; this is a safety check.
const MODEL = "claude-sonnet-5";

const SUPPORTED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
export const MAX_IMAGES = 4;

let client = null;
function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const LABEL_TOOL = {
  name: "record_label",
  description: "Record everything read from the supplement or food label photos.",
  input_schema: {
    type: "object",
    properties: {
      readable: {
        type: "boolean",
        description: "False if no ingredient list or supplement facts panel can be read in any photo.",
      },
      unreadable_reason: {
        type: "string",
        description: "If not readable: short, plain advice for the user (e.g. 'The ingredient list is cut off. Take a photo of the back panel.').",
      },
      product_name: { type: ["string", "null"] },
      brand:        { type: ["string", "null"] },
      ingredients: {
        type: "array",
        description: "Every ingredient from the Supplement/Nutrition Facts panel AND the 'Other ingredients' list, including every ingredient inside proprietary blends. One entry per ingredient.",
        items: {
          type: "object",
          properties: {
            name:    { type: "string", description: "Exactly as printed on the label." },
            aliases: {
              type: "array",
              items: { type: "string" },
              description: "Well-established chemical or common names for this exact ingredient (e.g. '1,3-dimethylamylamine' for 'DMAA'). Leave empty if unsure. Never guess.",
            },
            amount: { type: ["string", "null"], description: "Amount per serving as printed, e.g. '200 mg'. Null if not printed." },
            blend:  { type: ["string", "null"], description: "Name of the proprietary blend this ingredient belongs to, if any." },
          },
          required: ["name", "aliases", "amount", "blend"],
        },
      },
      proprietary_blends: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name:              { type: "string" },
            total_amount:      { type: ["string", "null"] },
            amounts_disclosed: { type: "boolean", description: "True only if every ingredient in the blend has its own amount printed." },
          },
          required: ["name", "total_amount", "amounts_disclosed"],
        },
      },
      certifications: {
        type: "array",
        description: "Third-party certification seals or logos actually visible on the label. Do not infer.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              enum: ["NSF Certified for Sport", "Informed Sport", "Informed Choice", "BSCG Certified Drug Free", "Other"],
            },
            text: { type: "string", description: "The seal text as printed." },
          },
          required: ["name", "text"],
        },
      },
      excluded_mentions: {
        type: "array",
        items: { type: "string" },
        description: "Substances mentioned only in marketing or 'free of' claims (e.g. 'DMAA-free', 'no artificial dyes'). These are NOT ingredients.",
      },
    },
    required: ["readable", "product_name", "brand", "ingredients", "proprietary_blends", "certifications", "excluded_mentions"],
  },
};

const INSTRUCTIONS = [
  "These photos show one supplement or food product, possibly from several sides.",
  "Read the label carefully and record it with the record_label tool.",
  "",
  "Rules:",
  "- List every ingredient from the facts panel and the 'Other ingredients' list, including each ingredient inside proprietary blends.",
  "- Copy names exactly as printed. Fix obvious line-break hyphenation (\"methylhexan-\" + \"eamine\" is one word).",
  "- If the same ingredient appears in several photos, list it once.",
  "- Anything mentioned only in a claim like 'free of X' or 'no X' goes in excluded_mentions, never in ingredients.",
  "- Only report certification seals you can actually see.",
  "- If text is blurry or cut off, only record what you can read with confidence. Do not guess ingredients.",
].join("\n");

// images: [{ data: base64 string (no data: prefix), mediaType: "image/jpeg" }]
export async function extractLabel(images) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Label reading is not configured.");

  const blocks = images.map((img) => {
    if (!SUPPORTED_MEDIA.has(img.mediaType)) throw new Error(`Unsupported image type: ${img.mediaType}`);
    return { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } };
  });

  const response = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 4000,
    tools: [LABEL_TOOL],
    tool_choice: { type: "tool", name: LABEL_TOOL.name },
    messages: [{ role: "user", content: [...blocks, { type: "text", text: INSTRUCTIONS }] }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse?.input) throw new Error("Label reader returned no result.");

  const out = toolUse.input;
  return {
    readable:           out.readable !== false && Array.isArray(out.ingredients) && out.ingredients.length > 0,
    unreadable_reason:  out.unreadable_reason || null,
    product_name:       out.product_name || null,
    brand:              out.brand || null,
    ingredients:        (out.ingredients || []).filter((i) => i && String(i.name || "").trim()),
    proprietary_blends: out.proprietary_blends || [],
    certifications:     out.certifications || [],
    excluded_mentions:  out.excluded_mentions || [],
  };
}
