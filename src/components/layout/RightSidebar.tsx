import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

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
