import { useEffect, useState } from "react";
import { getAdminOverview } from "@/services/admin";
import { useAuth } from "@/hooks/useAuth";

export function useAdminAccess() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (loading) return;
      if (!user) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      setChecking(true);
      try {
        await getAdminOverview();
        setIsAdmin(true);
        setError(null);
      } catch (err: any) {
        setIsAdmin(false);
        if (err?.status && err.status !== 403) setError(err.message || "Admin check failed");
      } finally {
        setChecking(false);
      }
    };
    run();
  }, [user, loading]);

  return { checking: loading || checking, isAdmin, error };
}
