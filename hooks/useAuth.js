import { useState } from "react";

export default function useAuth() {
  const [user, setUser] = useState(null);

  const login = async (email) => {
    try {
      const res = await fetch(
        `/api/lookupUser?email=${encodeURIComponent(email)}&t=${Date.now()}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      console.log("Lookup API Response:", res.status, data);

      if (!res.ok) throw new Error(data?.error || "Login failed");

      setUser(data);
      return data;
    } catch (err) {
      console.error("Login error:", err);
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
  };

  return { user, login, logout };
}
