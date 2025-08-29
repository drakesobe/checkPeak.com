// context/AuthContext.js
"use client";

import { createContext, useContext, useState } from "react";

// Create context
const AuthContext = createContext(null);

// Provider
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  // Lookup & login user by email
  const login = async (email) => {
    if (!email) throw new Error("Email is required for login");

    try {
      const res = await fetch(`/api/lookupUser?email=${encodeURIComponent(email)}&t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Login failed");

      setUser(data.user); // update context
      return data.user;
    } catch (err) {
      console.error("Login error:", err);
      throw err;
    }
  };

  // Sign up athlete with token, name, email
  const signupAthlete = async ({ token, name, email }) => {
    if (!token || !name || !email) throw new Error("Missing required fields");

    try {
      const res = await fetch("/api/athlete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name, email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Signup failed");

      setUser({ ...data, email, name }); // automatically log in in context
      return data;
    } catch (err) {
      console.error("Signup error:", err);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, signupAthlete }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use context
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext must be used within AuthProvider");
  return context;
};
