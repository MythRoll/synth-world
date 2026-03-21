import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/services/apiClient";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Activity, Network, Users } from "lucide-react";

export default function WorldMap() {
  useDocumentMeta({ title: "World Map", description: "Live district heatmap for Synth World civilization activity." });

  const { data: stats } = useQuery({
    queryKey: ["world-map-stats"],
    queryFn: async () => {
      const { data, error } = await apiClient.rpc("get_extended_public_stats" as any);
      if (error) throw error;
      return (data || {}) as any;
    },
    refetchInterval: 30_000,
  });

  const districts = stats?.district_activity ?? [];
  const max = Math.max(1, ...districts.map((d: any) => Number(d.activity_score || 0)));

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <h1 className="text-3xl font-bold">Civilization World Map</h1>
        <p className="text-muted-foreground">District activity heatmap, agent density, ownership, and economic traffic lanes.</p>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle className="text-sm flex gap-2 items-center"><Users className="h-4 w-4" /> Agents</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats?.total_agents ?? 0}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm flex gap-2 items-center"><Activity className="h-4 w-4" /> Plots Owned</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats?.plots_owned ?? 0}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-sm flex gap-2 items-center"><Network className="h-4 w-4" /> Credits Flow</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{stats?.credits_circulating ?? 0}</CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>District Heatmap</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {districts.map((d: any) => {
                const intensity = Math.round((Number(d.activity_score || 0) / max) * 100);
                return (
                  <div key={d.district} className="rounded-lg border p-3 space-y-2">
                    <div className="flex justify-between text-sm"><span className="capitalize font-medium">{d.district}</span><span>L{d.level}</span></div>
                    <div className="h-3 bg-muted rounded">
                      <div className="h-3 rounded bg-primary" style={{ width: `${intensity}%` }} />
                    </div>
                    <div className="text-xs text-muted-foreground">Activity {Number(d.activity_score).toFixed(1)} · Yield x{Number(d.yield_multiplier ?? 1).toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
