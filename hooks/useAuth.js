// hooks/useAuth.js
import { useState, createContext, useContext } from "react";

// --- Context creation
const AuthContext = createContext(null);

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

  // --- Login user (checks Airtable Athlete table)
  const login = async (email, password) => {
    try {
      const res = await fetch(
        `/api/lookupUser?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&t=${Date.now()}`,
        { cache: "no-store" }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login failed");

      setUser(data.user);
      return data.user;
    } catch (err) {
      console.error("Login error:", err);
      throw err;
    }
  };

  // --- Logout user
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  // --- Signup athlete using token + email + password
  const signupAthlete = async ({ token, name, email, password }) => {
    try {
      const res = await fetch("/api/athlete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Athlete signup failed");

      // Auto-login after signup
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

  // --- Signup organization using email + password
  const signupOrg = async ({ orgName, contactName, email, password }) => {
    try {
      const res = await fetch("/api/org-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, contactName, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Organization signup failed");

      // Auto-login after signup
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
