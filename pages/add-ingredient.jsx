// pages/add-ingredient.jsx
import { useState } from "react";
import Head from "next/head";

export default function AddIngredientPage() {
  const [form, setForm] = useState({
    ingredientName: "",
    productName: "",
    brandName: "",
    category: "",
    region: "",
    labelUrl: "",
    notes: "",
    email: "",
  });

  const reviewEmail = "Support@Checkpeak.com";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Build subject + body from current form values
  const subject = form.ingredientName
    ? `Ingredient suggestion: ${form.ingredientName}`
    : "Ingredient suggestion";

  const bodyLines = [
    `Ingredient name: ${form.ingredientName || "-"}`,
    `Product name: ${form.productName || "-"}`,
    `Brand: ${form.brandName || "-"}`,
    `Category: ${form.category || "-"}`,
    `Country / region: ${form.region || "-"}`,
    `Label or product URL: ${form.labelUrl || "-"}`,
    "",
    "Notes / concerns:",
    form.notes || "-",
    "",
    `Sender email (optional): ${form.email || "-"}`,
    "",
    "Submitted via CheckPeak 'Suggest an Ingredient' page.",
  ];

  const body = bodyLines.join("\n");

  const mailtoHref =
    `mailto:${reviewEmail}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return (
    <>
      <Head>
        <title>Suggest an Ingredient | CheckPeak</title>
        <meta
          name="description"
          content="Submit missing or unclear ingredients for the CheckPeak team to review and potentially add to the database."
        />
      </Head>
      <main className="min-h-screen bg-black text-gray-100">
        <div className="mx-auto max-w-2xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Suggest an Ingredient
          </h1>

          <p className="mt-2 text-sm text-gray-400">
            Help improve coverage by submitting missing, confusing, or newly
            marketed ingredients and blends. When you tap the button below,
            your device will open an email draft to our support team with these
            details pre-filled.
          </p>

          <div className="mt-4 rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-[11px] text-gray-400">
            <p>
              <span className="font-semibold text-emerald-300">Heads up:</span>{" "}
              You&apos;ll still need to press{" "}
              <span className="font-semibold">Send</span> in your email app to
              complete the submission. If nothing happens when you tap the
              button on desktop, make sure a default email app or handler (like
              Gmail in your browser) is set up.
            </p>
          </div>

          {/* We still use a form for layout, but we don't rely on onSubmit */}
          <form
            onSubmit={(e) => e.preventDefault()}
            className="mt-8 space-y-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5"
          >
            {/* Ingredient name */}
            <div>
              <label
                htmlFor="ingredientName"
                className="block text-xs font-medium text-gray-300"
              >
                Ingredient name <span className="text-emerald-400">*</span>
              </label>
              <input
                id="ingredientName"
                name="ingredientName"
                type="text"
                required
                value={form.ingredientName}
                onChange={handleChange}
                placeholder="e.g. N-methyl-hexanamine, proprietary stimulant blend, etc."
                className="mt-1 w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Product details */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="productName"
                  className="block text-xs font-medium text-gray-300"
                >
                  Product name
                </label>
                <input
                  id="productName"
                  name="productName"
                  type="text"
                  value={form.productName}
                  onChange={handleChange}
                  placeholder="Brand X Pre-Workout"
                  className="mt-1 w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="brandName"
                  className="block text-xs font-medium text-gray-300"
                >
                  Brand
                </label>
                <input
                  id="brandName"
                  name="brandName"
                  type="text"
                  value={form.brandName}
                  onChange={handleChange}
                  placeholder="Brand name"
                  className="mt-1 w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Category / Region */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="category"
                  className="block text-xs font-medium text-gray-300"
                >
                  Category
                </label>
                <input
                  id="category"
                  name="category"
                  type="text"
                  value={form.category}
                  onChange={handleChange}
                  placeholder="Pre-workout, fat burner, test booster, etc."
                  className="mt-1 w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="region"
                  className="block text-xs font-medium text-gray-300"
                >
                  Country / region
                </label>
                <input
                  id="region"
                  name="region"
                  type="text"
                  value={form.region}
                  onChange={handleChange}
                  placeholder="e.g. US, EU, UK, Canada"
                  className="mt-1 w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Label URL */}
            <div>
              <label
                htmlFor="labelUrl"
                className="block text-xs font-medium text-gray-300"
              >
                Link to label or product page
              </label>
              <input
                id="labelUrl"
                name="labelUrl"
                type="url"
                value={form.labelUrl}
                onChange={handleChange}
                placeholder="https://brand.com/product/label"
                className="mt-1 w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-xs font-medium text-gray-300"
              >
                Notes or concerns
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                value={form.notes}
                onChange={handleChange}
                placeholder="Why does this ingredient concern you? Any links, claims, or test results we should know about?"
                className="mt-1 w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Email (optional) */}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-gray-300"
              >
                Your email (optional)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="If you’d like us to follow up"
                className="mt-1 w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                We&apos;ll only use this if we need clarification. No spam.
              </p>
            </div>

            {/* "Submit" – actually an <a> with mailto */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] text-gray-500">
                When you click the button, your device will open a pre-filled
                email draft to our support inbox using these details.
              </p>

              <a
                href={mailtoHref}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-black shadow-sm transition hover:bg-emerald-400"
              >
                Open email draft
              </a>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
