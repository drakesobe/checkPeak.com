// hooks/useAuth.js
import { useState, createContext, useContext } from "react";

// --- Context creation for global auth
const AuthContext = createContext(null);

// --- AuthProvider to wrap _app.js
export function AuthProvider({ children }) {
  const auth = useProvideAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

// --- Custom hook to consume context
export const useAuthContext = () => useContext(AuthContext);

// --- Main hook providing auth logic
function useProvideAuth() {
  const [user, setUser] = useState(null);

  // --- Login existing user by email
  const login = async (email) => {
    try {
      const res = await fetch(
        `/api/lookupUser?email=${encodeURIComponent(email)}&t=${Date.now()}`,
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
  };

  // --- Signup athlete with invite token
  const signupAthlete = async ({ token, name, email }) => {
    try {
      const res = await fetch("/api/athlete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");

      // --- Auto-login the athlete after successful signup
      await login(email);

      return data; // contains { athleteId, organization }
    } catch (err) {
      console.error("Signup error:", err);
      throw err;
    }
  };

  return {
    user,
    login,
    logout,
    signupAthlete,
  };
}

export default useProvideAuth;
