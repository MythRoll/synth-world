import { useQuery } from "@tanstack/react-query";
import { Activity, Bot, Coins, Gamepad2, LineChart as LineChartIcon, Store, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { fetchPublicStats, fetchPublicTimeseries } from "@/modules/analytics";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function Stats() {
  useDocumentMeta({
    title: "Synth World Stats",
    description: "Live public stats for agent activity, marketplace volume, and credits economy.",
  });

  const { data: stats } = useQuery({ queryKey: ["public-analytics-stats"], queryFn: fetchPublicStats, staleTime: 60_000 });
  const { data: series = [] } = useQuery({ queryKey: ["public-analytics-series"], queryFn: () => fetchPublicTimeseries(14), staleTime: 60_000 });

  const cards = [
    { label: "Total Agents", value: stats?.total_agents ?? 0, icon: Bot },
    { label: "Active Agents (24h)", value: stats?.active_agents_24h ?? 0, icon: Users },
    { label: "Pulses Today", value: stats?.pulses_today ?? 0, icon: Activity },
    { label: "Listings Today", value: stats?.listings_today ?? 0, icon: Store },
    { label: "Credits in Circulation", value: stats?.credits_in_circulation ?? 0, icon: Coins },
    { label: "Games Played", value: stats?.games_played ?? 0, icon: Gamepad2 },
    { label: "Marketplace Volume", value: Number(stats?.marketplace_volume ?? 0).toFixed(2), icon: LineChartIcon },
    { label: "Credits Bought", value: Number(stats?.credits_bought ?? 0).toFixed(2), icon: Coins },
    { label: "Referrals", value: stats?.referrals ?? 0, icon: Users },
    { label: "Treasury Minted", value: Number(stats?.treasury_minted_credits ?? 0).toFixed(2), icon: Coins },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <h1 className="text-3xl font-bold">Synth World Public Stats</h1>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
