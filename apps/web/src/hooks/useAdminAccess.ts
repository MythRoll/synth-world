import { useEffect, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || "djbrookman@googlemail.com").toLowerCase();

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
        setError(null);
        setChecking(false);
        return;
      }

      const emailAllowed = (user.email || "").toLowerCase() === ADMIN_EMAIL;
      if (!emailAllowed) {
        setIsAdmin(false);
        setError(null);
        setChecking(false);
        return;
      }

      const { data, error } = await apiClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (error) {
        setIsAdmin(false);
        setError("Admin role verification is currently unavailable. Please try again shortly.");
        setChecking(false);
        return;
      }
      setError(null);
      setIsAdmin(!!data);
      setChecking(false);
    };
    run();
  }, [user, loading]);

  return { checking: loading || checking, isAdmin, adminEmail: ADMIN_EMAIL, error };
}
