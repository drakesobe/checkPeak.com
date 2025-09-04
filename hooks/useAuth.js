import { useState, createContext, useContext, useEffect } from "react";

// --- Context creation
const AuthContext = createContext(null);

// --- Helper to parse user from cookie
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

// --- AuthProvider to wrap _app.js
export function AuthProvider({ children }) {
  const auth = useProvideAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

// --- Custom hook to consume context
export const useAuthContext = () => useContext(AuthContext);

// --- Main hook providing auth logic
export function useProvideAuth() {
  const [user, setUser] = useState(null);

  // --- Restore persisted user from localStorage or cookies on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      const cookieUser = getUserFromCookie();

      if (storedUser) setUser(JSON.parse(storedUser));
      else if (cookieUser) setUser(cookieUser);
    }
  }, []);

  // --- Login user
  const login = async (email, password) => {
    try {
      const res = await fetch(
        `/api/lookupUser?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&t=${Date.now()}`,
        { cache: "no-store" }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");

      setUser(data.user);

      // Persist login in localStorage and cookie
      if (typeof window !== "undefined") {
        localStorage.setItem("user", JSON.stringify(data.user));
        document.cookie = `user=${encodeURIComponent(JSON.stringify(data.user))}; path=/;`;
      }

      return data.user;
    } catch (err) {
      console.error("Login error:", err);
      throw err;
    }
  };

  // --- Logout user
  const logout = () => {
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
      document.cookie = "user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
  };

  // --- Signup athlete
  const signupAthlete = async ({ token, name, email, password }) => {
    try {
      const res = await fetch("/api/athlete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Athlete signup failed");

      const loggedInUser = await login(email, password);

      return {
        ...data,
        user: loggedInUser,
        role: "Athlete",
        message: `Athlete account created and logged in as ${loggedInUser.Name}`,
      };
    } catch (err) {
      console.error("Athlete signup error:", err);
      throw err;
    }
  };

  // --- Signup organization
  const signupOrg = async ({ orgName, contactName, email, password }) => {
    try {
      const res = await fetch("/api/org-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, contactName, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Organization signup failed");

      const loggedInUser = await login(email, password);

      return {
        ...data,
        user: loggedInUser,
        role: "Organization",
        message: `Organization account created and logged in as ${loggedInUser.Name}`,
      };
    } catch (err) {
      console.error("Organization signup error:", err);
      throw err;
    }
  };

  return {
    user,
    login,
    logout,
    signupAthlete,
    signupOrg,
  };
}

export default useProvideAuth;
