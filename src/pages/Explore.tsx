import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import type { PublicAgent } from "@/hooks/useAgents";

type AgentWithCaps = PublicAgent & { agent_capabilities: Tables<"agent_capabilities">[] };

export default function Explore() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  const { data: agents } = useQuery({
    queryKey: ["explore-agents", query, filter],
    queryFn: async () => {
      // Fetch agents via security-definer RPC
      const { data: agentsData, error } = await supabase.rpc("get_public_agents");
      if (error) throw error;

      let results = (agentsData || []) as PublicAgent[];

      // Client-side name filter
      if (query) {
        const q = query.toLowerCase();
        results = results.filter((a) => a.name.toLowerCase().includes(q));
      }

      // Fetch capabilities for all agents
      const agentIds = results.map((a) => a.id);
      const { data: caps } = await supabase
        .from("agent_capabilities")
        .select("*")
        .in("agent_id", agentIds.length ? agentIds : ["__none__"]);

      const capsByAgent = new Map<string, Tables<"agent_capabilities">[]>();
      (caps || []).forEach((c) => {
        const arr = capsByAgent.get(c.agent_id) || [];
        arr.push(c);
        capsByAgent.set(c.agent_id, arr);
      });

      let withCaps = results.map((a) => ({
        ...a,
        agent_capabilities: capsByAgent.get(a.id) || [],
      })) as AgentWithCaps[];

      if (filter) {
        withCaps = withCaps.filter((a) => a.agent_capabilities.some((c) => c.category === filter));
      }

      return withCaps.slice(0, 50);
    },
  });

  const categoryColor: Record<string, string> = {
    compute: "bg-purple-100 text-purple-700 border-purple-200",
    search: "bg-amber-100 text-amber-700 border-amber-200",
    action: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <AppLayout>
      <div className="p-4 border-b sticky top-14 z-20 bg-background/80 backdrop-blur-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents by name or skill..." className="pl-9" />
        </div>
        <div className="flex gap-2">
          {["compute", "search", "action"].map((cat) => (
            <Button key={cat} variant={filter === cat ? "default" : "outline"} size="sm" className="text-xs capitalize" onClick={() => setFilter(filter === cat ? null : cat)}>
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="divide-y">
        {agents?.map((agent) => (
          <Link key={agent.id} to={`/agent/${agent.id}`} className="flex gap-3 p-4 hover:bg-accent/30 transition-colors">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FrameworkIcon framework={agent.framework} className="h-7 w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{agent.name}</span>
                <span className="text-xs text-muted-foreground font-mono">@{agent.framework}</span>
              </div>
              {agent.bio && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{agent.bio}</p>}
              {agent.agent_capabilities.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {agent.agent_capabilities.slice(0, 4).map((c) => (
                    <Badge key={c.id} variant="outline" className={`text-[10px] px-1.5 py-0 ${categoryColor[c.category] || ""}`}>
                      {c.skill_name}
                    </Badge>
                  ))}
                  {agent.agent_capabilities.length > 4 && (
                    <span className="text-[10px] text-muted-foreground">+{agent.agent_capabilities.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          </Link>
        ))}
        {agents?.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No agents found</div>
        )}
      </div>
    </AppLayout>
  );
}
