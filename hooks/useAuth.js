// hooks/useAuth.js
import { useState, createContext, useContext, useEffect } from "react";

const AuthContext = createContext(null);

/**
 * Auth model:
 * - UI user state is hydrated from localStorage (because the server cookie is HttpOnly)
 * - Server auth for /api/org/* relies on the HttpOnly `user` cookie
 * - Therefore ALL auth-related fetch calls MUST use credentials: "include"
 */

export function AuthProvider({ children }) {
  const auth = useProvideAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export const useAuthContext = () => useContext(AuthContext);

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export function useProvideAuth() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Hydrate UI user from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem("user");
      if (stored) {
        const parsed = safeJsonParse(stored);
        if (parsed) setUser(parsed);
      }
    } catch (e) {
      console.error("Failed restoring user from localStorage", e);
      localStorage.removeItem("user");
    } finally {
      setAuthReady(true);
    }
  }, []);

  // Tiny helper so we don’t forget credentials/include
  const apiFetch = async (url, options = {}) => {
    return fetch(url, {
      ...options,
      credentials: "include", // ✅ critical for HttpOnly cookie auth
    });
  };

  /**
   * LOGIN
   * - role: "athlete" | "organization"
   * - Server sets HttpOnly cookie in /api/lookupUser
   * - We store user in localStorage for UI hydration only
   */
  const login = async (email, password, role = "athlete") => {
    const emailNorm = String(email || "").trim().toLowerCase();
    const roleNorm =
      String(role || "").trim().toLowerCase() === "organization"
        ? "organization"
        : "athlete";

    const res = await apiFetch("/api/lookupUser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailNorm,
        password: String(password || ""),
        role: roleNorm,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Login failed");

    setUser(data.user || null);

    if (typeof window !== "undefined") {
      localStorage.setItem("user", JSON.stringify(data.user || null));
    }

    return data.user;
  };

  /**
   * LOGOUT
   * - Clears local UI state/localStorage
   * - Clears HttpOnly cookie server-side via /api/logout (if you have it)
   */
  const logout = async () => {
    setUser(null);

    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
    }

    try {
      await apiFetch("/api/logout", { method: "POST" });
    } catch (err) {
      console.warn("[logout] failed to clear cookie (non-fatal):", err);
    }
  };

  /**
   * ATHLETE SIGNUP
   * - Creates athlete record
   * - Then logs in (server sets HttpOnly cookie)
   */
  const signupAthlete = async ({ token, name, email, password }) => {
    const emailNorm = String(email || "").trim().toLowerCase();

    const res = await apiFetch("/api/athlete-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: String(token || "").trim(),
        name: String(name || "").trim(),
        email: emailNorm,
        password: String(password || ""), // plain; server hashes
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Athlete signup failed");

    const loggedInUser = await login(emailNorm, password, "athlete");

    return {
      ...data,
      user: loggedInUser,
      role: "Athlete",
      message: `Athlete account created and logged in as ${
        loggedInUser?.Name || loggedInUser?.name || "Athlete"
      }`,
    };
  };

  /**
   * ORG SIGNUP
   * - Creates org record (server hashes password, generates Token)
   * - Then logs in as organization (server sets HttpOnly cookie)
   */
  const signupOrganization = async ({
    name,
    email,
    password,
    contactName = "",
    phoneNumber = "",
    website = "",
    address = "",
    notes = "",
    type = "Organization",
  }) => {
    const emailNorm = String(email || "").trim().toLowerCase();

    const res = await apiFetch("/api/org-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: String(name || "").trim(),
        email: emailNorm,
        password: String(password || ""),
        contactName: String(contactName || "").trim(),
        phoneNumber: String(phoneNumber || "").trim(),
        website: String(website || "").trim(),
        address: String(address || "").trim(),
        notes: String(notes || "").trim(),
        type: String(type || "Organization").trim(),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Organization signup failed");

    const loggedInUser = await login(emailNorm, password, "organization");

    return {
      ...data,
      user: loggedInUser,
      role: "Organization",
      message: `Organization created and logged in as ${
        loggedInUser?.Name || loggedInUser?.name || "Organization"
      }`,
    };
  };

  return {
    user,
    authReady,
    login,
    logout,
    signupAthlete,
    signupOrganization,
    setUser, // optional escape hatch
  };
}

export default useProvideAuth;
