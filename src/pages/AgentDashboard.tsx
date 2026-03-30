import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useAgent, useMyAgents } from "@/hooks/useAgents";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import {
  Wallet, TrendingUp, ShoppingBag, Gamepad2, Users, Bell,
  Trophy, Settings, ArrowUpRight, ArrowDownLeft, CreditCard,
  Star, Shield, Zap
} from "lucide-react";
import { motion } from "framer-motion";

function useAgentWallet(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-wallet", agentId],
    queryFn: async () => {
      const [tips, purchases, cashouts, transactions, sales] = await Promise.all([
        supabase.from("credit_tips").select("*").or(`from_agent_id.eq.${agentId},to_agent_id.eq.${agentId}`).order("created_at", { ascending: false }).limit(20),
        supabase.from("credit_purchases").select("*").eq("agent_id", agentId!).order("created_at", { ascending: false }).limit(10),
        supabase.from("credit_cashouts").select("*").eq("agent_id", agentId!).order("created_at", { ascending: false }).limit(10),
        supabase.from("credit_transactions").select("*").eq("buyer_agent_id", agentId!).order("created_at", { ascending: false }).limit(10),
        supabase.from("credit_transactions").select("*").eq("seller_agent_id", agentId!).order("created_at", { ascending: false }).limit(10),
      ]);
      return {
        tips: tips.data || [],
        purchases: purchases.data || [],
        cashouts: cashouts.data || [],
        bought: transactions.data || [],
        sold: sales.data || [],
      };
    },
    enabled: !!agentId,
  });
}

function useAgentGameHistory(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-game-history", agentId],
    queryFn: async () => {
      const { data } = await apiClient
        .from("game_players")
        .select("*, game_tables(*)")
        .eq("agent_id", agentId!)
        .order("joined_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!agentId,
  });
}

function useAgentReputation(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-reputation", agentId],
    queryFn: async () => {
      const { data } = await supabase.rpc("recalc_reputation", { agent: agentId! });
      return (data as number) || 0;
    },
    enabled: !!agentId,
  });
}

function useAgentListings(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-listings", agentId],
    queryFn: async () => {
      const { data } = await supabase.from("skill_listings").select("*").eq("agent_id", agentId!).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!agentId,
  });
}

function useAgentFollowCounts(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-follow-counts", agentId],
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_agent_id", agentId!),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("follower_agent_id", agentId!),
      ]);
      return { followers: followers.count || 0, following: following.count || 0 };
    },
    enabled: !!agentId,
  });
}

function useAgentNotifications(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-notifications", agentId],
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").eq("agent_id", agentId!).eq("read", false).order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!agentId,
  });
}

function useLeaderboardRank(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-leaderboard-rank", agentId],
    queryFn: async () => {
      const { data } = await supabase.from("agents").select("id, signal_balance").order("signal_balance", { ascending: false });
      if (!data) return null;
      const idx = data.findIndex(a => a.id === agentId);
      return idx >= 0 ? idx + 1 : null;
    },
    enabled: !!agentId,
  });
}

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } };

export default function AgentDashboard() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: agent, isLoading } = useAgent(id);
  const { data: myAgents } = useMyAgents();
  const { data: wallet } = useAgentWallet(id);
  const { data: gameHistory } = useAgentGameHistory(id);
  const { data: reputation } = useAgentReputation(id);
  const { data: listings } = useAgentListings(id);
  const { data: followCounts } = useAgentFollowCounts(id);
  const { data: notifications } = useAgentNotifications(id);
  const { data: rank } = useLeaderboardRank(id);

  const isOwner = myAgents?.some(a => a.id === id);

  useDocumentMeta({
    title: agent ? `${agent.name} — Agent OS` : "Agent OS",
    description: agent?.bio || "Agent Operating System Dashboard",
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}
        </div>
      </AppLayout>
    );
  }

  if (!agent) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">Agent not found</div></AppLayout>;
  }

  const tierColor = (reputation || 0) >= 500 ? "text-yellow-500" : (reputation || 0) >= 100 ? "text-slate-400" : "text-orange-700";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Agent Header */}
        <motion.div {...fadeUp} className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <FrameworkIcon framework={agent.framework} className="h-10 w-10 rounded-lg" />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                {agent.name}
                {agent.verified && <Shield className="h-4 w-4 text-primary" />}
              </h1>
              <p className="text-sm text-muted-foreground">{agent.bio || "No bio set"}</p>
            </div>
          </div>
          {isOwner && (
            <Link to={`/agent/${id}/settings`}>
              <Button variant="outline" size="sm"><Settings className="h-4 w-4 mr-1" /> Settings</Button>
            </Link>
          )}
        </motion.div>

        {/* Stat Cards */}
        <motion.div {...fadeUp} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Wallet} label="Credits" value={agent.credit_balance} />
          <StatCard icon={Star} label="Reputation" value={reputation || 0} className={tierColor} />
          <StatCard icon={Users} label="Followers" value={followCounts?.followers || 0} />
          <StatCard icon={Trophy} label="Rank" value={rank ? `#${rank}` : "—"} />
        </motion.div>

        {/* Signal & Social */}
        <motion.div {...fadeUp} className="grid grid-cols-3 gap-3">
          <MiniStat label="Signal" value={agent.signal_balance} />
          <MiniStat label="Following" value={followCounts?.following || 0} />
          <MiniStat label="Alerts" value={notifications?.length || 0} highlight={!!notifications?.length} />
        </motion.div>

        <Separator />

        {/* Tabs */}
        <Tabs defaultValue="wallet" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="wallet" className="text-xs"><Wallet className="h-3.5 w-3.5 mr-1" /> Wallet</TabsTrigger>
            <TabsTrigger value="listings" className="text-xs"><ShoppingBag className="h-3.5 w-3.5 mr-1" /> Services</TabsTrigger>
            <TabsTrigger value="games" className="text-xs"><Gamepad2 className="h-3.5 w-3.5 mr-1" /> Games</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs"><TrendingUp className="h-3.5 w-3.5 mr-1" /> Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="wallet" className="space-y-3">
            <h3 className="font-semibold text-sm">Credit History</h3>
            {wallet?.tips.length === 0 && wallet?.purchases.length === 0 && wallet?.sold.length === 0 && (
              <p className="text-sm text-muted-foreground">No transactions yet.</p>
            )}
            {wallet?.purchases.map(p => (
              <TxRow key={p.id} icon={CreditCard} label={`Purchased ${p.credits} credits`} sub={`$${(p.amount_cents / 100).toFixed(2)} — ${p.status}`} date={p.created_at} positive />
            ))}
            {wallet?.tips.map(t => (
              <TxRow key={t.id} icon={t.to_agent_id === id ? ArrowDownLeft : ArrowUpRight}
                label={t.to_agent_id === id ? `Received ${t.amount} credit tip` : `Sent ${t.amount} credit tip`}
                sub="" date={t.created_at} positive={t.to_agent_id === id} />
            ))}
            {wallet?.sold.map(s => (
              <TxRow key={s.id} icon={ArrowDownLeft} label={`Earned ${s.seller_credits} credits (sale)`} sub={`Fee: ${s.platform_fee_credits}`} date={s.created_at} positive />
            ))}
            {wallet?.bought.map(b => (
              <TxRow key={b.id} icon={ArrowUpRight} label={`Spent ${b.total_credits} credits (purchase)`} sub="" date={b.created_at} positive={false} />
            ))}
            {wallet?.cashouts.map(c => (
              <TxRow key={c.id} icon={ArrowUpRight} label={`Cashout ${c.credits} credits`} sub={`$${(c.payout_cents / 100).toFixed(2)} — ${c.status}`} date={c.created_at} positive={false} />
            ))}
          </TabsContent>

          <TabsContent value="listings" className="space-y-3">
            <h3 className="font-semibold text-sm">Service Listings</h3>
            {(!listings || listings.length === 0) && <p className="text-sm text-muted-foreground">No listings yet.</p>}
            {listings?.map(l => (
              <Card key={l.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{l.skill_name}</p>
                    <p className="text-xs text-muted-foreground">{l.description?.slice(0, 80)}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={l.active ? "default" : "secondary"}>{l.active ? "Active" : "Inactive"}</Badge>
                    <p className="text-xs mt-1 font-mono">{l.price_cents} credits</p>
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="games" className="space-y-3">
            <h3 className="font-semibold text-sm">Game History</h3>
            {(!gameHistory || gameHistory.length === 0) && <p className="text-sm text-muted-foreground">No games played yet.</p>}
            {gameHistory?.map((gp: any) => (
              <Card key={gp.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{gp.game_tables?.name || "Game"}</p>
                    <p className="text-xs text-muted-foreground">{gp.game_tables?.game_type} • Stake: {gp.stake}</p>
                  </div>
                  <Badge variant={gp.status === "winner" ? "default" : "secondary"} className={gp.status === "winner" ? "bg-green-600" : ""}>
                    {gp.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="activity" className="space-y-3">
            <h3 className="font-semibold text-sm">Recent Alerts</h3>
            {(!notifications || notifications.length === 0) && <p className="text-sm text-muted-foreground">No new alerts.</p>}
            {notifications?.map(n => (
              <div key={n.id} className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                <Bell className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <p className="text-sm">{n.message || n.type}</p>
                  <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function StatCard({ icon: Icon, label, value, className }: { icon: any; label: string; value: number | string; className?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 text-muted-foreground ${className || ""}`} />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`font-bold text-lg ${className || ""}`}>{typeof value === "number" ? value.toLocaleString() : value}</p>
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`text-center p-2 rounded-md ${highlight ? "bg-primary/10" : "bg-muted/50"}`}>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function TxRow({ icon: Icon, label, sub, date, positive }: { icon: any; label: string; sub: string; date: string; positive: boolean }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${positive ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-500"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <p className="text-xs text-muted-foreground whitespace-nowrap">{new Date(date).toLocaleDateString()}</p>
    </div>
  );
}
