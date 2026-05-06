// pages/contact.jsx
import Head from "next/head";

export default function ContactPage() {
  const supportEmail = "support@checkpeak.com"; // change to your real support email

  return (
    <>
      <Head>
        <title>Contact | CheckPeak</title>
        <meta
          name="description"
          content="Get in touch with the CheckPeak team for support, feedback, and partnership inquiries."
        />
      </Head>
      <main className="min-h-screen bg-black text-gray-100">
        <div className="mx-auto max-w-2xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Contact
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Questions, feedback, or partnership ideas? Reach out - we read every
            message.
          </p>

          {/* Email card */}
          <div className="mt-8 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h2 className="text-sm font-semibold text-white">
              General inquiries &amp; support
            </h2>
            <p className="mt-2 text-sm text-gray-300">
              For questions about scan results, feature suggestions, or account
              issues, email us at:
            </p>
            <a
              href={`mailto:${supportEmail}`}
              className="mt-3 inline-flex items-center text-sm font-medium text-emerald-400 hover:text-emerald-300"
            >
              {supportEmail}
            </a>
          </div>

          {/* Quick notes */}
          <div className="mt-6 space-y-3 text-xs text-gray-400">
            <p className="font-semibold text-gray-300">Helpful details to include:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Brand and product name (e.g., “Brand X Pre-Workout”)</li>
              <li>
                A clear photo or screenshot of the ingredient label (front +
                back if possible)
              </li>
              <li>
                Any specific ingredients or blends you&apos;re concerned about
              </li>
              <li>
                Whether you&apos;re competing under a specific organization
                (NCAA, USAPL, etc.)
              </li>
            </ul>
          </div>

          {/* Disclaimer */}
          <div className="mt-8 rounded-lg border border-gray-800 bg-gray-900/60 p-4 text-xs text-gray-400">
            <p>
              Do not send medical emergencies or urgent health concerns via
              email. Contact your doctor, pharmacist, or local emergency
              services instead. CheckPeak cannot provide personalized medical
              advice or guarantee drug test outcomes.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
