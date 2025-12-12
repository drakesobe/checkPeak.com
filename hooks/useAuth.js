import { useState, createContext, useContext, useEffect } from "react";

const AuthContext = createContext(null);

function getUserFromCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/user=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch (e) {
    console.error("Failed to parse user cookie", e);
    return null;
  }
}

export function AuthProvider({ children }) {
  const auth = useProvideAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export const useAuthContext = () => useContext(AuthContext);

export function useProvideAuth() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedUser = localStorage.getItem("user");
    const cookieUser = getUserFromCookie();

    try {
      if (storedUser) setUser(JSON.parse(storedUser));
      else if (cookieUser) setUser(cookieUser);
    } catch (e) {
      console.error("Failed restoring user", e);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const emailNorm = String(email || "").trim().toLowerCase();

      const res = await fetch("/api/lookupUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          email: emailNorm,
          password: String(password || ""),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Login failed");

      setUser(data.user);

      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(data.user));
        document.cookie = `user=${encodeURIComponent(
          JSON.stringify(data.user)
        )}; path=/;`;
      }

      return data.user;
    } catch (err) {
      console.error("Login error:", err);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
      document.cookie =
        "user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
  };

  const signupAthlete = async ({ token, name, email, password }) => {
    try {
      const res = await fetch("/api/athlete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          token: String(token || "").trim(),
          name: String(name || "").trim(),
          email: String(email || "").trim().toLowerCase(),
          password: String(password || ""), // plain, server hashes
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Athlete signup failed");

      const loggedInUser = await login(email, password);

      return {
        ...data,
        user: loggedInUser,
        role: "Athlete",
        message: `Athlete account created and logged in as ${
          loggedInUser?.Name || loggedInUser?.name || "Athlete"
        }`,
      };
    } catch (err) {
      console.error("Athlete signup error:", err);
      throw err;
    }
  };

  const signupOrg = async ({ orgName, contactName, email, password }) => {
    try {
      const res = await fetch("/api/org-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ orgName, contactName, email, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Organization signup failed");

      const loggedInUser = await login(email, password);

      return {
        ...data,
        user: loggedInUser,
        role: "Organization",
        message: `Organization account created and logged in as ${
          loggedInUser?.Name || loggedInUser?.name || "Organization"
        }`,
      };
    } catch (err) {
      console.error("Organization signup error:", err);
      throw err;
    }
  };

  return { user, login, logout, signupAthlete, signupOrg };
}

export default useProvideAuth;
