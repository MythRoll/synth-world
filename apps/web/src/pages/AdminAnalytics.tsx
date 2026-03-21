import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/services/apiClient";
import { useQuery } from "@tanstack/react-query";
import { fetchAdminDashboard } from "@/modules/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from "recharts";

export default function AdminAnalytics() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!user) {
        setChecked(true);
        return;
      }
      const { data } = await apiClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
      setIsAdmin(Boolean(data));
      setChecked(true);
    };
    check();
  }, [user]);

  const { data: dashboard = {} } = useQuery({
    queryKey: ["admin-analytics-dashboard"],
    queryFn: () => fetchAdminDashboard(30),
    enabled: checked && isAdmin,
    staleTime: 30_000,
  });

  const trend = useMemo(() => (dashboard as any).traffic_trends ?? [], [dashboard]);
  const eventBreakdown = useMemo(() => (dashboard as any).event_breakdown ?? [], [dashboard]);
  const referrers = useMemo(() => (dashboard as any).referrers ?? [], [dashboard]);
  const registrations = useMemo(() => (dashboard as any).daily_registrations ?? [], [dashboard]);
  const topAgents = useMemo(() => (dashboard as any).top_agents ?? [], [dashboard]);
  const spikes = useMemo(() => (dashboard as any).suspicious_spikes ?? [], [dashboard]);
  const failedWebhooks = useMemo(() => (dashboard as any).failed_webhooks ?? [], [dashboard]);
  const creditsTrend = useMemo(() => (dashboard as any).credits_economy_trend ?? [], [dashboard]);

  if (loading || !checked) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  }
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader><CardTitle>Admin access required</CardTitle></CardHeader>
          <CardContent><Button onClick={() => navigate("/")}>Go Home</Button></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-2xl font-bold">Admin Analytics</h1>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Traffic Trends</CardTitle></CardHeader>
            <CardContent className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><XAxis dataKey="day" /><YAxis /><Tooltip /><Line dataKey="events" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Credits Economy Trend</CardTitle></CardHeader>
            <CardContent className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={creditsTrend}><XAxis dataKey="day" /><YAxis /><Tooltip /><Line dataKey="credits_bought" stroke="#22c55e" dot={false} /><Line dataKey="treasury_minted" stroke="#f59e0b" dot={false} /><Line dataKey="treasury_distributed" stroke="#3b82f6" dot={false} /></LineChart></ResponsiveContainer></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Daily Registrations</CardTitle></CardHeader>
            <CardContent className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={registrations}><XAxis dataKey="day" /><YAxis /><Tooltip /><Bar dataKey="registrations" fill="hsl(var(--primary))" /></BarChart></ResponsiveContainer></CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Event Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[280px] overflow-auto text-sm">{eventBreakdown.map((row: any) => <div key={row.event_type} className="flex justify-between"><span>{row.event_type}</span><span className="font-semibold">{row.count}</span></div>)}</CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Top Referrers</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">{referrers.map((r: any) => <div key={r.referrer} className="flex justify-between"><span className="truncate mr-2">{r.referrer}</span><span>{r.count}</span></div>)}</CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Top Agents by Activity</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">{topAgents.map((a: any) => <div key={a.agent_id} className="flex justify-between"><span className="truncate mr-2">{a.name}</span><span>{a.activity}</span></div>)}</CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Risk Signals</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Suspicious spikes</span><span>{spikes.length}</span></div>
              <div className="flex justify-between"><span>Failed webhooks</span><span>{failedWebhooks.length}</span></div>
              <div className="flex justify-between"><span>Rate-limit hits</span><span>{(dashboard as any).rate_limit_hits ?? 0}</span></div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
