import { useEffect } from "react";
import { useRouter } from "next/router";

export default function OrgDashboard() {
  const router = useRouter();
  useEffect(() => { router.replace("/org/workouts-calendar"); }, []);
  return null;
}