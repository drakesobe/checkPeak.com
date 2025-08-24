// pages/org-signup.js
import Head from "next/head";
import { useState } from "react";
import NavBar from "../components/NavBar";
import { nanoid } from "nanoid";

export default function OrgSignupPage() {
  const [formData, setFormData] = useState({
    orgName: "",
    contactName: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Generate a unique token for the organization
      const token = nanoid(10);

      const res = await fetch("/api/org-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, token }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMessage(
          `Organization created successfully! Share this signup link with your athletes: ${window.location.origin}/athlete-signup/${token}`
        );
        setFormData({ orgName: "", contactName: "", email: "", password: "" });
      } else {
        setErrorMessage(data.error || "Failed to create organization.");
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>PEAK — Organization Sign-Up</title>
        <meta
          name="description"
          content="Sign up your university, business, or athletic department to manage supplement compliance with PEAK."
        />
      </Head>

      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <NavBar activeTab="OrgSignup" setActiveTab={() => {}} />

        <section className="py-16 bg-blue-600 text-white text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Organization Sign-Up
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-6">
            Register your organization to manage athlete supplement compliance
            and access PEAK features.
          </p>
        </section>

        <section className="py-16 bg-white">
          <div className="max-w-xl mx-auto px-4">
            <form
              onSubmit={handleSubmit}
              className="bg-gray-50 p-8 rounded-xl shadow-lg space-y-6"
            >
              {errorMessage && (
                <p className="text-red-600 font-semibold">{errorMessage}</p>
              )}
              {successMessage && (
                <p className="text-green-600 font-semibold">{successMessage}</p>
              )}

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  name="orgName"
                  value={formData.orgName}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Head Coach / Trainer Name
                </label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-2">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-2xl shadow hover:bg-blue-700 transition"
              >
                {loading ? "Creating Organization..." : "Create Organization Account"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
