"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { useAuthContext } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";

export default function AccountPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  // --- Form state ---
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    organization: "",
    title: "",
    phone: "",
    created: "",
  });
  const [originalData, setOriginalData] = useState({});
  const hasChanges = useRef(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [validation, setValidation] = useState({ email: true, phone: true });

  // --- Organizations ---
  const [orgs, setOrgs] = useState([]);
  const [orgMeta, setOrgMeta] = useState({});

  // --- Change password modal state ---
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // --- Validate helpers ---
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validatePhone = (phone) => /^\+?\d{7,15}$/.test(phone);

  // --- Load user data ---
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const initialData = {
      name: user?.Name || user?.name || "",
      email: user?.Email || user?.email || "",
      organization: user?.Organization || "",
      title: user?.Title || "",
      phone: user?.Phone || "",
      created: user?.Created || "",
    };

    setFormData(initialData);
    setOriginalData(initialData);
  }, [user, router]);

  // --- Fetch organizations ---
  useEffect(() => {
    async function fetchOrgs() {
      try {
        const res = await fetch("/api/get-organizations");
        const data = await res.json();
        if (res.ok) setOrgs(data.organizations || []);
        else console.error("Get organizations error:", data.error);
      } catch (err) {
        console.error("Get organizations error:", err);
      }
    }
    fetchOrgs();
  }, []);

  // --- Update organization metadata when selection changes ---
  useEffect(() => {
    const selectedOrg = orgs.find((o) => o.id === formData.organization);
    setOrgMeta(selectedOrg || {});
  }, [formData.organization, orgs]);

  if (!user) return null;

  // --- Handlers ---
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "email") setValidation((prev) => ({ ...prev, email: validateEmail(value) }));
    if (name === "phone") setValidation((prev) => ({ ...prev, phone: validatePhone(value) }));

    hasChanges.current =
      value !== originalData[name] ||
      Object.keys(formData).some((key) => formData[key] !== originalData[key]);
  };

  const handleSave = async () => {
    if (!validation.email || !validation.phone) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/update-athlete", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: user.id,
          updates: {
            Name: formData.name,
            Email: formData.email,
            Organization: formData.organization,
            Title: formData.title,
            Phone: formData.phone,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save changes");

      setMessage("Profile updated successfully!");
      setOriginalData({ ...formData });
      hasChanges.current = false;
    } catch (err) {
      console.error("Update error:", err);
      setError(err.message || "Error updating profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const savePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setPasswordSaving(true);
    setPasswordError("");
    setPasswordMessage("");

    try {
      const res = await fetch("/api/update-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: user.id,
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Password update failed");

      setPasswordMessage("Password updated successfully!");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error(err);
      setPasswordError(err.message || "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-blue-50 font-sans">
      <NavBar activeTab="Account" setActiveTab={() => {}} />

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-blue-100 space-y-6">
          <h1 className="text-2xl font-bold text-gray-800 text-center">Account Settings</h1>
          <p className="text-gray-600 text-center text-sm mb-6">
            Manage your profile and account preferences
          </p>

          {/* Feedback */}
          <AnimatePresence>
            {(message || error) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`text-center text-sm font-medium py-2 rounded ${
                  message ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                {message || error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Personal & Organization Info */}
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-700">Personal Info</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-800 font-medium mb-1">Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full border border-blue-100 rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-gray-900"
                />
              </div>

              <div>
                <label className="block text-gray-800 font-medium mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full border rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 transition text-gray-900 ${
                    validation.email ? "border-blue-100 focus:ring-blue-400" : "border-red-400 focus:ring-red-400"
                  }`}
                />
                {!validation.email && <p className="text-red-500 text-sm mt-1">Invalid email format</p>}
              </div>

              <div>
                <label className="block text-gray-800 font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full border rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 transition text-gray-900 ${
                    validation.phone ? "border-blue-100 focus:ring-blue-400" : "border-red-400 focus:ring-red-400"
                  }`}
                />
                {!validation.phone && <p className="text-red-500 text-sm mt-1">Invalid phone number</p>}
              </div>

              <div>
                <label className="block text-gray-800 font-medium mb-1">Created</label>
                <input
                  type="text"
                  value={formData.created}
                  readOnly
                  className="w-full border border-blue-100 rounded-2xl px-4 py-2 bg-gray-50 text-gray-600"
                />
              </div>
            </div>

            <h2 className="text-lg font-semibold text-gray-700 mt-6">Organization Info</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-800 font-medium mb-1">Organization</label>
                <select
                  name="organization"
                  value={formData.organization}
                  onChange={handleChange}
                  className="w-full border border-blue-100 rounded-2xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-gray-900"
                >
                  <option value="">Select an organization</option>
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.fields?.Name || org.fields?.["Short Name"] || "Unnamed Org"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-800 font-medium mb-1">Title / Role</label>
                <input
                  type="text"
                  value={formData.title}
                  readOnly
                  className="w-full border border-blue-100 rounded-2xl px-4 py-2 bg-gray-50 text-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col space-y-3">
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges.current || !validation.email || !validation.phone}
              className={`w-full py-3 rounded-2xl text-white font-medium ${
                saving || !hasChanges.current || !validation.email || !validation.phone
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full py-3 rounded-2xl bg-blue-100 text-blue-800 font-medium hover:bg-blue-200 transition"
            >
              Change Password
            </button>

            <button
              onClick={() => logout()}
              className="w-full py-3 rounded-2xl bg-red-100 text-red-800 font-medium hover:bg-red-200 transition"
            >
              Log Out
            </button>
          </div>
        </div>
      </main>

      {/* --- Change Password Modal --- */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          >
            <div className="bg-white rounded-2xl p-6 w-full max-w-md relative">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Change Password</h2>

              {passwordError && <p className="text-red-500 mb-2">{passwordError}</p>}
              {passwordMessage && <p className="text-green-600 mb-2">{passwordMessage}</p>}

              <input
                type="password"
                placeholder="Current Password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                className="w-full border border-blue-100 rounded-2xl px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-gray-900"
              />
              <input
                type="password"
                placeholder="New Password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                className="w-full border border-blue-100 rounded-2xl px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-gray-900"
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                className="w-full border border-blue-100 rounded-2xl px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-gray-900"
              />

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 rounded-2xl bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={savePassword}
                  disabled={passwordSaving}
                  className={`px-4 py-2 rounded-2xl text-white font-medium ${
                    passwordSaving ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {passwordSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
