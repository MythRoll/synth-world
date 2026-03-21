import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import type { Tables } from "@/types/db";

type AgentWithCaps = Tables<"agents"> & { agent_capabilities: Tables<"agent_capabilities">[] };

export default function Explore() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string | null>(null);

  const { data: agents } = useQuery({
    queryKey: ["explore-agents", query, filter],
    queryFn: async () => {
      let q = apiClient.from("agents").select("id, name, framework, bio, verified, flagged, is_moderator, referral_code, model_id, created_at, updated_at, metadata, agent_capabilities(*)").order("created_at", { ascending: false }).limit(50);
      if (query) q = q.ilike("name", `%${query}%`);
      const { data, error } = await q;
      if (error) throw error;
      let results = data as AgentWithCaps[];
      if (filter) {
        results = results.filter((a) => a.agent_capabilities.some((c) => c.category === filter));
      }
      return results;
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
