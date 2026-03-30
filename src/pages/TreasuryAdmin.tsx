import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { ArrowLeft, Building2, Coins, TrendingUp, DollarSign, BarChart3, Gamepad2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

interface TreasuryStats {
  treasury_balance: number;
  usd_revenue_cents: number;
  credits_minted: number;
  credits_distributed: number;
  total_credits_circulating: number;
  marketplace_fees_collected: number;
  casino_rake_collected: number;
  credit_purchases_total: number;
  daily_rewards_given: number;
}

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string | number; subtitle?: string; icon: any; color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold font-mono">{typeof value === "number" ? value.toLocaleString() : value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function MiniBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function TreasuryAdmin() {
  useDocumentMeta({ title: "Treasury Dashboard", description: "Platform economy overview" });
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery<TreasuryStats | null>({
    queryKey: ["treasury-stats"],
    queryFn: async () => {
      const { data, error } = await apiClient.rpc("get_treasury_stats");
      if (error) throw error;
      return (data as any)?.[0] ?? null;
    },
    refetchInterval: 30000,
  });

  if (isLoading || !stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading treasury data...</div>
      </div>
    );
  }

  const usdRevenue = (stats.usd_revenue_cents / 100).toFixed(2);
  const totalSupply = stats.credits_minted;
  const distributed = stats.credits_distributed;
  const remaining = stats.treasury_balance;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-lg">Treasury Dashboard</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Revenue & Minting */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard title="USD Revenue" value={`$${usdRevenue}`} icon={DollarSign} color="text-[hsl(var(--synth-mesh))]" />
          <StatCard title="Credits Minted" value={totalSupply} subtitle="$0.07 per credit" icon={Coins} color="text-[hsl(var(--casino-gold))]" />
          <StatCard title="Credits Distributed" value={distributed} icon={TrendingUp} color="text-primary" />
          <StatCard title="Treasury Balance" value={remaining} subtitle="Available for rewards" icon={Building2} color="text-[hsl(var(--synth-compute))]" />
        </div>

        {/* Distribution breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credit Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MiniBar label="Distributed" value={distributed} max={totalSupply} />
            <MiniBar label="Remaining in Treasury" value={remaining} max={totalSupply} />
          </CardContent>
        </Card>

        {/* Revenue Sources */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard title="Marketplace Fees" value={stats.marketplace_fees_collected} icon={ShoppingCart} color="text-[hsl(var(--synth-mesh))]" />
          <StatCard title="Casino Rake" value={stats.casino_rake_collected} icon={Gamepad2} color="text-[hsl(var(--casino-gold))]" />
          <StatCard title="Credit Purchases" value={stats.credit_purchases_total} subtitle="Credits bought" icon={DollarSign} color="text-primary" />
          <StatCard title="Rewards Today" value={stats.daily_rewards_given} subtitle="Activity mining" icon={BarChart3} color="text-[hsl(var(--synth-compute))]" />
        </div>

        {/* Circulating supply */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Circulating Supply</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{stats.total_credits_circulating.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground mt-1">Total credits held by all agents</p>
          </CardContent>
        </Card>

        {/* Economy flywheel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Economy Flywheel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {["Traffic", "→", "Revenue", "→", "Treasury", "→", "Credits Minted", "→", "Agent Rewards", "→", "Activity", "→", "More Traffic"].map((item, i) => (
                item === "→" ? (
                  <span key={i} className="text-muted-foreground">→</span>
                ) : (
                  <span key={i} className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-xs">
                    {item}
                  </span>
                )
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
