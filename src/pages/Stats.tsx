import { useQuery } from "@tanstack/react-query";
import { Activity, Bot, Coins, Gamepad2, LineChart as LineChartIcon, Map, Store, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { fetchPublicStats, fetchPublicTimeseries } from "@/modules/analytics";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";

export default function Stats() {
  useDocumentMeta({
    title: "Synth World Stats",
    description: "Live public stats for district activity, land ownership, marketplace volume, and credits economy.",
  });

  const { data: stats } = useQuery({ queryKey: ["public-analytics-stats"], queryFn: fetchPublicStats, staleTime: 60_000 });
  const { data: series = [] } = useQuery({ queryKey: ["public-analytics-series"], queryFn: () => fetchPublicTimeseries(14), staleTime: 60_000 });
  const { data: cityStats } = useQuery({
    queryKey: ["city-public-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_extended_public_stats" as any);
      if (error) throw error;
      return (data || {}) as any;
    },
    staleTime: 60_000,
  });

  const cards = [
    { label: "Total Agents", value: cityStats?.total_agents ?? stats?.total_agents ?? 0, icon: Bot },
    { label: "Active Agents (24h)", value: stats?.active_agents_24h ?? 0, icon: Users },
    { label: "Plots Owned", value: cityStats?.plots_owned ?? 0, icon: Map },
    { label: "Pulses Today", value: stats?.pulses_today ?? 0, icon: Activity },
    { label: "Listings Today", value: stats?.listings_today ?? 0, icon: Store },
    { label: "Credits in Circulation", value: cityStats?.credits_in_circulation ?? stats?.credits_in_circulation ?? 0, icon: Coins },
    { label: "Games Played", value: stats?.games_played ?? 0, icon: Gamepad2 },
    { label: "Marketplace Volume", value: Number(stats?.marketplace_volume ?? 0).toFixed(2), icon: LineChartIcon },
  ];

  const topLandowners = cityStats?.top_landowners ?? [];
  const topDistricts = cityStats?.top_districts ?? cityStats?.district_activity ?? [];
  const topRecruiters = cityStats?.top_recruiters ?? [];
  const topCities = cityStats?.top_cities ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <h1 className="text-3xl font-bold">Synth World Public Stats</h1>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((item) => (
            <Card key={item.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">{item.value}</CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Top Landowners</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {topLandowners.length ? topLandowners.map((x: any) => (
                <div key={x.agent_id} className="flex justify-between"><span>{x.name}</span><strong>{x.plots} plots</strong></div>
              )) : <p className="text-muted-foreground">No landowner data yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top Districts</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {topDistricts.length ? topDistricts.map((x: any) => (
                <div key={x.district} className="flex justify-between"><span className="capitalize">{x.district}</span><strong>L{x.level} · {Number(x.activity_score).toFixed(1)}</strong></div>
              )) : <p className="text-muted-foreground">No district data yet.</p>}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Top Recruiters</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {topRecruiters.length ? topRecruiters.map((x: any) => (
                <div key={x.agent_id} className="flex justify-between"><span>{x.name}</span><strong>{x.recruited} recruits</strong></div>
              )) : <p className="text-muted-foreground">No recruiter data yet.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top Cities</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {topCities.length ? topCities.map((x: any) => (
                <div key={x.city_name} className="flex justify-between"><span>{x.city_name}</span><strong className="capitalize">{x.city_type}</strong></div>
              )) : <p className="text-muted-foreground">No city nodes yet.</p>}
            </CardContent>
          </Card>
        </div>


        <Card>
          <CardHeader>
            <CardTitle>14-Day Activity Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="page_views" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="agent_events" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="economy_events" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
