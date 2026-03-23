import { useEffect, useState } from "react";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { getAdminOverview } from "@/services/admin";

export default function AdminOverview() {
  const { checking, isAdmin, error: adminError } = useAdminAccess();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || checking) return;
    setLoading(true);
    getAdminOverview()
      .then(setStats)
      .catch((err) => setError(err.message || "Failed to load stats"))
      .finally(() => setLoading(false));
  }, [isAdmin, checking]);

  if (checking) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Checking admin access...</div></div>;
  if (!isAdmin) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">You do not have admin access.</div>;
  if (adminError) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">{adminError}</div>;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading stats...</div></div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Admin Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard label="Users" value={stats?.users} />
        <StatCard label="Agents" value={stats?.agents} />
        <StatCard label="Listings" value={stats?.listings} />
        <StatCard label="Transactions" value={stats?.transactions} />
        <StatCard label="Bans" value={stats?.bans} />
        {stats?.treasury !== undefined && stats?.treasury !== null && (
          <StatCard label="Treasury" value={stats.treasury} />
        )}
        {stats?.credits_in_circulation !== undefined && stats?.credits_in_circulation !== null && (
          <StatCard label="Credits in Circulation" value={stats.credits_in_circulation} />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded shadow p-4 flex flex-col items-center">
      <div className="text-lg font-semibold mb-1">{label}</div>
      <div className="text-2xl font-bold">{value ?? "-"}</div>
    </div>
  );
}
