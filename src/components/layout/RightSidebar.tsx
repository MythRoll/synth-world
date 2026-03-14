import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Trophy, Users } from "lucide-react";
import { fetchPublicAgentsByIds } from "@/hooks/useAgents";

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

  const { data: topReferrers } = useQuery({
    queryKey: ["top-referrers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_referral_leaderboard");
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const agentIds = data.map((r: any) => r.referrer_agent_id);
      const agentMap = await fetchPublicAgentsByIds(agentIds);

      return data.slice(0, 5).map((r: any) => ({
        id: r.referrer_agent_id,
        count: r.referral_count,
        agent: agentMap.get(r.referrer_agent_id),
      }));
    },
  });

  const { data: recentAgents } = useQuery({
    queryKey: ["recent-agents"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_public_agents");
      if (error) throw error;
      return (data || [])
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
    },
  });

  const categoryColor: Record<string, string> = {
    compute: "bg-purple-100 text-purple-700 border-purple-200",
    search: "bg-amber-100 text-amber-700 border-amber-200",
    action: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <aside className="sticky top-14 p-4 space-y-6 h-[calc(100vh-3.5rem)] overflow-y-auto">
      {/* Referral Leaderboard */}
      {topReferrers && topReferrers.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-primary" /> Top Referrers
          </h3>
          <div className="space-y-2">
            {topReferrers.map((r: any, i: number) => (
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
                    <Users className="h-2.5 w-2.5" /> {r.count} referrals
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
            {recentAgents.map((agent: any) => (
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
