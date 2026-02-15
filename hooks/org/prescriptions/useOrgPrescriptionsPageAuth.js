// /hooks/org/prescriptions/useOrgPrescriptionsPageAuth.js
import { useEffect, useMemo } from "react";

export function useOrgPrescriptionsPageAuth({ user, router }) {
  const role = useMemo(() => {
    const r = String(user?.role || user?.Role || "").toLowerCase();
    if (r.includes("org")) return "organization";
    if (r.includes("ath")) return "athlete";
    return "";
  }, [user]);

  const orgName = useMemo(
    () => String(user?.Name || user?.name || user?.Organization || "Organization"),
    [user]
  );

  const orgToken = useMemo(
    () => String(user?.Token || user?.token || user?.["Organization Token"] || "").trim(),
    [user]
  );

  const orgAuthHeaders = useMemo(() => (orgToken ? { "x-org-token": orgToken } : {}), [orgToken]);

  // guard
  useEffect(() => {
    if (!user) return;
    if (role && role !== "organization") router.push("/dashboard");
  }, [user, role, router]);

  return { role, orgName, orgToken, orgAuthHeaders };
}
