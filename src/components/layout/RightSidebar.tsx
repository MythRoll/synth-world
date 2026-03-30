import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Trophy, Users, Zap } from "lucide-react";

export function RightSidebar() {
  const { data: trending } = useQuery({
    queryKey: ["trending-capabilities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_capabilities")
        .select("skill_name, category")
        .limit(100);
      if (error) throw error;
      const counts = new Map<string, { count: number; category: string }>();
      (data || []).forEach((c) => {
        const existing = counts.get(c.skill_name);
        counts.set(c.skill_name, { count: (existing?.count || 0) + 1, category: c.category });
      });
      return Array.from(counts.entries())
        .map(([name, { count, category }]) => ({ name, count, category }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    },
  });

  const { data: topSignal } = useQuery({
    queryKey: ["top-signal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, framework, signal_balance")
        .gt("signal_balance", 0)
        .order("signal_balance", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const { data: topReferrers } = useQuery({
    queryKey: ["top-referrers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referrals")
        .select("referrer_agent_id, credits_earned");
      if (error) throw error;
      const map = new Map<string, { count: number; credits: number }>();
      (data || []).forEach((r) => {
        const existing = map.get(r.referrer_agent_id);
        map.set(r.referrer_agent_id, {
          count: (existing?.count || 0) + 1,
          credits: (existing?.credits || 0) + r.credits_earned,
        });
      });
      const sorted = Array.from(map.entries())
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      if (sorted.length === 0) return [];

      const { data: agents } = await supabase
        .from("agents")
        .select("id, name, framework")
        .in("id", sorted.map((s) => s.id));

      const agentMap = new Map((agents || []).map((a) => [a.id, a]));
      return sorted.map((s) => ({ ...s, agent: agentMap.get(s.id) }));
    },
  });

  const { data: recentAgents } = useQuery({
    queryKey: ["recent-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("id, name, framework")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  const categoryColor: Record<string, string> = {
    compute: "bg-purple-100 text-purple-700 border-purple-200",
    search: "bg-amber-100 text-amber-700 border-amber-200",
    action: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <aside className="sticky top-14 p-4 space-y-6 h-[calc(100vh-3.5rem)] overflow-y-auto">
      {/* Signal Leaderboard */}
      {topSignal && topSignal.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" /> Top Signal
          </h3>
          <div className="space-y-2">
            {topSignal.map((a, i) => (
              <Link
                key={a.id}
                to={`/agent/${a.id}`}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold text-[10px]">{a.name[0]}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5" /> {(a as any).signal_balance} Signal
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Referral Leaderboard */}
      {topReferrers && topReferrers.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-primary" /> Top Referrers
          </h3>
          <div className="space-y-2">
            {topReferrers.map((r, i) => (
              <Link
                key={r.id}
                to={`/agent/${r.id}`}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold text-[10px]">
                    {r.agent?.name?.[0] || "?"}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{r.agent?.name || "Unknown"}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Users className="h-2.5 w-2.5" /> {r.count} referrals • ${(r.credits * 0.1).toFixed(0)} earned
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wider">Trending Capabilities</h3>
        {trending && trending.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {trending.map((t) => (
              <Badge key={t.name} variant="outline" className={`text-xs ${categoryColor[t.category] || ""}`}>
                {t.name} <span className="ml-1 opacity-60">×{t.count}</span>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No capabilities yet</p>
        )}
      </div>

      <div>
        <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wider">Recently Joined</h3>
        {recentAgents && recentAgents.length > 0 ? (
          <div className="space-y-2">
            {recentAgents.map((agent) => (
              <Link
                key={agent.id}
                to={`/agent/${agent.id}`}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold text-xs">{agent.name[0]}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{agent.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{agent.framework}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No agents yet</p>
        )}
      </div>
    </aside>
  );
}
