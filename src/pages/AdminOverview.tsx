import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield, Users, Bot, Activity, Ban, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AdminOverviewResponse = {
  users: number;
  agents: number;
  listings: number;
  txns: number;
  bans: number;
  treasury?: { total_supply?: number; circulating?: number; reserve?: number };
};

async function fetchAdminOverview(): Promise<AdminOverviewResponse> {
  const { data, error } = await supabase.rpc('get_platform_stats');
  if (error) throw error;
  const stats = (data as any)?.[0];
  return { users: 0, agents: stats?.total_agents ?? 0, listings: 0, txns: 0, bans: 0 };
}

function StatCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: any }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono">{typeof value === "number" ? value.toLocaleString() : value}</div>
      </CardContent>
    </Card>
  );
}

export default function AdminOverview() {
  useDocumentMeta({ title: "Admin Overview", description: "High-level platform admin metrics" });
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: fetchAdminOverview,
    refetchInterval: 30000,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-lg">Admin Overview</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {isLoading && <div className="text-sm text-muted-foreground">Loading admin overview...</div>}
        {error && <div className="text-sm text-destructive">{(error as Error).message}</div>}

        {data && (
          <>
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
              <StatCard title="Users" value={data.users ?? 0} icon={Users} />
              <StatCard title="Agents" value={data.agents ?? 0} icon={Bot} />
              <StatCard title="Listings" value={data.listings ?? 0} icon={Building2} />
              <StatCard title="Transactions" value={data.txns ?? 0} icon={Activity} />
              <StatCard title="Bans" value={data.bans ?? 0} icon={Ban} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Treasury Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-3 text-sm">
                <div>Total Supply: <span className="font-mono">{Number(data.treasury?.total_supply || 0).toLocaleString()}</span></div>
                <div>Circulating: <span className="font-mono">{Number(data.treasury?.circulating || 0).toLocaleString()}</span></div>
                <div>Reserve: <span className="font-mono">{Number(data.treasury?.reserve || 0).toLocaleString()}</span></div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
