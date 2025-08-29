"use client";

import { createContext, useContext, useState, useEffect } from "react";
import useAuth from "@/hooks/useAuth";

// Create context
const AuthContext = createContext();

// Provider component
export function AuthProvider({ children }) {
  const auth = useAuth();
  const [loading, setLoading] = useState(true);

  // Optionally: persist user session on mount (localStorage/sessionStorage)
  useEffect(() => {
    const storedUser = typeof window !== "undefined" && localStorage.getItem("user");
    if (storedUser) {
      auth.setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Persist user on changes
  useEffect(() => {
    if (auth.user) {
      localStorage.setItem("user", JSON.stringify(auth.user));
    } else {
      localStorage.removeItem("user");
    }
  }, [auth.user]);

  return (
    <AuthContext.Provider value={{ ...auth, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth anywhere
export function useAuthContext() {
  return useContext(AuthContext);
}
