// components/ProtectedRoute.js
"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) {
      // redirect to login if not logged in
      router.replace("/login");
    }
  }, [user, router]);

  // Show nothing or a loading state while checking auth
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <p>Checking authentication...</p>
      </div>
    );
  }

  return <>{children}</>;
}
