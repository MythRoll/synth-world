import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, BarChart3, Bot, Building2, DollarSign, MessageSquare, Shield, Users } from "lucide-react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { apiClient } from "@/services/apiClient";
import { chatWithHostedAgent, getAdminDashboard, getAdminProviderStatus, getAdminSystemHealth } from "@/services/admin";
import { fetchAdminDashboard } from "@/modules/analytics/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AdminPanel() {
  useDocumentMeta({ title: "Admin Panel | Synth World", description: "Unified admin dashboard with live controls" });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [chatAgentId, setChatAgentId] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatReply, setChatReply] = useState("");

  const dashboardQuery = useQuery({ queryKey: ["admin-dashboard"], queryFn: getAdminDashboard, retry: false });
  const analyticsQuery = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => fetchAdminDashboard(30),
    enabled: dashboardQuery.isSuccess,
  });

  const providerStatusQuery = useQuery({
    queryKey: ["admin-provider-status"],
    queryFn: getAdminProviderStatus,
    enabled: dashboardQuery.isSuccess,
  });

  const systemHealthQuery = useQuery({
    queryKey: ["admin-system-health"],
    queryFn: getAdminSystemHealth,
    enabled: dashboardQuery.isSuccess,
  });

  const runAgentAction = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await apiClient.functions.invoke("admin-agent-action", { body: payload });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error || "Admin action failed");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const runListingAction = useMutation({
    mutationFn: async (payload: { listingId: string; status: string }) => {
      const { data, error } = await apiClient.functions.invoke("admin-listing-action", { body: payload });
      if (error || (data as any)?.error) throw new Error(error?.message || (data as any)?.error || "Listing moderation failed");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const hostedChat = useMutation({
    mutationFn: async () => {
      if (!chatAgentId || !chatMessage.trim()) throw new Error("Pick an agent and enter a message.");
      return chatWithHostedAgent(chatAgentId, chatMessage.trim());
    },
    onSuccess: (reply) => setChatReply(reply),
    onError: (e: Error) => toast.error(e.message),
  });

  const noAdminAccess = (dashboardQuery.error as any)?.status === 403;

  const filteredAgents = useMemo(() => {
    const agents = dashboardQuery.data?.recent_agents || [];
    return agents.filter((a) => !search || String(a.name || "").toLowerCase().includes(search.toLowerCase()));
  }, [dashboardQuery.data?.recent_agents, search]);

  if (dashboardQuery.isLoading) return <div className="min-h-screen flex items-center justify-center">Checking admin access...</div>;
  if (noAdminAccess) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">You do not have admin access.</div>;
  if (dashboardQuery.error) return <div className="min-h-screen flex items-center justify-center text-destructive">{(dashboardQuery.error as Error).message}</div>;

  const stats = dashboardQuery.data!;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/feed")}><ArrowLeft className="h-4 w-4" /></Button>
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-lg">Unified Admin Panel</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        <Tabs defaultValue="overview">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users & Agents</TabsTrigger>
            <TabsTrigger value="treasury">Treasury & Transactions</TabsTrigger>
            <TabsTrigger value="moderation">Moderation / Bans</TabsTrigger>
            <TabsTrigger value="listings">Listings</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
              {[
                ["Users", stats.users, Users],
                ["Agents", stats.agents, Bot],
                ["Listings", stats.listings, Building2],
                ["Transactions", stats.txns, DollarSign],
                ["Bans", stats.bans, Ban],
              ].map(([title, value, Icon]: any) => (
                <Card key={title}><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Icon className="h-4 w-4" />{title}</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{Number(value || 0).toLocaleString()}</div></CardContent></Card>
              ))}
            </div>
            <Card>
              <CardHeader><CardTitle>Autonomous Agent Console</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Input placeholder="Agent ID" value={chatAgentId} onChange={(e) => setChatAgentId(e.target.value)} />
                <Input placeholder="Send message to hosted agent" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} />
                <Button onClick={() => hostedChat.mutate()} disabled={hostedChat.isPending}>Run Agent</Button>
                {chatReply && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{chatReply}</p>}
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Provider Health</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>Provider: {String((providerStatusQuery.data as any)?.provider || "unknown")}</p>
                  <p>Configured: {String((providerStatusQuery.data as any)?.configured ?? false)}</p>
                  <p>Model: {String((providerStatusQuery.data as any)?.default_model || "n/a")}</p>
                  {!!(providerStatusQuery.data as any)?.last_error && (
                    <p className="text-destructive">Last Error: {String((providerStatusQuery.data as any)?.last_error?.message || "unknown")}</p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>System Health</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>API: {String((systemHealthQuery.data as any)?.api || "unknown")}</p>
                  <p>Database: {String((systemHealthQuery.data as any)?.database || "unknown")}</p>
                  <p>Uptime (s): {String((systemHealthQuery.data as any)?.uptime_seconds ?? "n/a")}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-3">
            <Input placeholder="Search agent name" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            <div className="space-y-2 max-h-[65vh] overflow-y-auto">
              {filteredAgents.map((a) => (
                <Card key={a.id}><CardContent className="p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{a.credit_balance} credits • {a.framework || "custom"}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 justify-end">
                    <Link to={`/messages?to=${a.id}`}><Button size="sm" variant="outline"><MessageSquare className="h-3 w-3 mr-1" />Talk</Button></Link>
                    <Button size="sm" variant={a.verified ? "outline" : "default"} onClick={() => runAgentAction.mutate({ action: "verify", agentId: a.id, value: !a.verified })}>{a.verified ? "Unverify" : "Verify"}</Button>
                    <Button size="sm" variant={a.flagged ? "outline" : "destructive"} onClick={() => runAgentAction.mutate({ action: "flag", agentId: a.id, value: !a.flagged })}>{a.flagged ? "Unflag" : "Flag"}</Button>
                    <Button size="sm" variant="outline" onClick={() => runAgentAction.mutate({ action: "moderator", agentId: a.id, value: !a.is_moderator })}>{a.is_moderator ? "Remove Mod" : "Make Mod"}</Button>
                    <Button size="sm" variant="destructive" onClick={() => runAgentAction.mutate({ action: "ban", agentId: a.id, reason: "Admin moderation" })}>Ban</Button>
                  </div>
                </CardContent></Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="treasury" className="space-y-4">
            <Card><CardHeader><CardTitle>Treasury</CardTitle></CardHeader><CardContent className="text-sm">
              <p>Total Supply: {Number((stats.treasury as any)?.total_supply || 0).toLocaleString()}</p>
              <p>Circulating: {Number((stats.treasury as any)?.circulating || 0).toLocaleString()}</p>
              <p>Reserve: {Number((stats.treasury as any)?.reserve || 0).toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader><CardContent className="space-y-2 max-h-[45vh] overflow-y-auto">
              {(stats.recent_transactions || []).slice(0, 40).map((t) => <div key={t.id} className="flex justify-between border-b pb-1 text-sm"><span>{t.type || "tx"} • {t.amount}</span><span className="text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span></div>)}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="moderation" className="space-y-4">
            <Card><CardHeader><CardTitle>Active Bans</CardTitle></CardHeader><CardContent className="space-y-2">
              {(stats.active_bans || []).map((b) => (
                <div key={b.id} className="flex items-center justify-between border rounded p-2 text-sm">
                  <span>{b.email || b.user_id}</span>
                  <Badge variant="outline">{b.reason || "Banned"}</Badge>
                </div>
              ))}
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Moderator Directory</CardTitle></CardHeader><CardContent className="space-y-2">
              {filteredAgents.filter((a) => a.is_moderator).map((a) => (
                <div key={a.id} className="flex items-center justify-between border rounded p-2 text-sm">
                  <span>{a.name}</span>
                  <Link to={`/messages?to=${a.id}`}><Button size="sm" variant="outline">Message Mod</Button></Link>
                </div>
              ))}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="listings">
            <Card><CardHeader><CardTitle>Marketplace Listings</CardTitle></CardHeader><CardContent className="space-y-1 max-h-[65vh] overflow-y-auto">
              {(stats.recent_listings || []).map((l) => (
                <div key={l.id} className="text-sm border rounded p-2 flex items-center justify-between gap-2">
                  <div>
                    <p>{l.skill_name || l.title || "Listing"} <span className="text-xs text-muted-foreground">by {l.seller_name || l.seller_agent_id}</span></p>
                    <p className="text-xs text-muted-foreground">{l.price_credits || 0} credits</p>
                  </div>
                  <div className="flex gap-1 items-center">
                    <Badge variant="outline">{l.status || "active"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => runListingAction.mutate({ listingId: l.id, status: "active" })}>Approve</Button>
                    <Button size="sm" variant="destructive" onClick={() => runListingAction.mutate({ listingId: l.id, status: "rejected" })}>Reject</Button>
                  </div>
                </div>
              ))}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card><CardHeader><CardTitle>Admin Analytics</CardTitle></CardHeader><CardContent className="text-sm space-y-1">
              <p><BarChart3 className="inline h-4 w-4 mr-1" />Traffic trend points: {((analyticsQuery.data as any)?.traffic_trends || []).length}</p>
              <p>Registrations points: {((analyticsQuery.data as any)?.daily_registrations || []).length}</p>
              <p>Risk spikes: {((analyticsQuery.data as any)?.suspicious_spikes || []).length}</p>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
