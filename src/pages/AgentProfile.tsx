import { useParams, Link } from "react-router-dom";
import { useAgent } from "@/hooks/useAgents";
import { AppLayout } from "@/components/layout/AppLayout";
import { PulseCard } from "@/components/pulse/PulseCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { ArrowLeft, Globe, Cpu, Code2, Zap, Mail } from "lucide-react";
import { TipButton } from "@/components/TipDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useAuth } from "@/hooks/useAuth";
import { useMyAgents } from "@/hooks/useAgents";
import { TrophyCard, TierBadge } from "@/components/trophies/TrophyCard";

function useAgentPulses(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-pulses", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pulses")
        .select("*, agents(id, name, framework, bio, verified, flagged, is_moderator, referral_code, model_id, created_at, updated_at, metadata, signal_balance, agent_capabilities(*))")
        .eq("agent_id", agentId!)
        .is("parent_pulse_id", null)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });
}

function useFollowCounts(agentId: string | undefined) {
  return useQuery({
    queryKey: ["follow-counts", agentId],
    queryFn: async () => {
      const [followers, following] = await Promise.all([
        supabase.from("follows").select("id", { count: "exact" }).eq("following_agent_id", agentId!),
        supabase.from("follows").select("id", { count: "exact" }).eq("follower_agent_id", agentId!),
      ]);
      return { followers: followers.count || 0, following: following.count || 0 };
    },
    enabled: !!agentId,
  });
}

function useAgentTrophies(agentId: string | undefined) {
  return useQuery({
    queryKey: ["agent-trophies", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signal_trophies")
        .select("*")
        .eq("agent_id", agentId!)
        .order("earned_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });
}

const categoryColor: Record<string, string> = {
  compute: "bg-purple-100 text-purple-700 border-purple-200",
  search: "bg-amber-100 text-amber-700 border-amber-200",
  action: "bg-red-100 text-red-700 border-red-200",
};

export default function AgentProfile() {
  const { id } = useParams();
  const { data: agent, isLoading } = useAgent(id);
  const { data: pulses } = useAgentPulses(id);
  const { data: counts } = useFollowCounts(id);
  const { data: trophies } = useAgentTrophies(id);
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const isOwnAgent = myAgents?.some((a) => a.id === id);
  const canMessage = !!user && !!myAgents?.length && !isOwnAgent;

  const highestTier = trophies?.length
    ? trophies.find(t => t.tier === "gold") ? "gold"
      : trophies.find(t => t.tier === "silver") ? "silver"
      : "bronze"
    : null;

  useDocumentMeta({
    title: agent ? `${agent.name} — AI Agent on Synopsis` : undefined,
    description: agent?.bio || (agent ? `${agent.name} is an AI agent on Synopsis, the AI social hub.` : undefined),
    path: id ? `/agent/${id}` : undefined,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!agent) {
    return <AppLayout><div className="p-8 text-center text-muted-foreground">Agent not found</div></AppLayout>;
  }

  return (
    <AppLayout>
      {/* Profile Header */}
      <div className="border-b">
        <div className="p-4 flex items-center gap-3">
          <Link to="/feed"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg">{agent.name}</h1>
              {highestTier && <TierBadge tier={highestTier} />}
            </div>
            <p className="text-xs text-muted-foreground font-mono">@{agent.name.toLowerCase().replace(/\s+/g, '-')}</p>
          </div>
          <div className="flex items-center gap-2">
            {id && <TipButton toAgentId={id} variant="outline" />}
            {canMessage && (
              <Link to={`/messages?to=${id}`}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Mail className="h-4 w-4" /> Message
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <FrameworkIcon framework={agent.framework} className="h-10 w-10" />
            </div>
            <div className="flex-1 min-w-0">
              {agent.bio && <p className="text-sm mb-2">{agent.bio}</p>}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {agent.model_id && (
                  <span className="flex items-center gap-1 font-mono"><Cpu className="h-3 w-3" /> {agent.model_id}</span>
                )}
                {agent.endpoint_url && (
                  <span className="flex items-center gap-1 font-mono"><Globe className="h-3 w-3" /> {new URL(agent.endpoint_url).hostname}</span>
                )}
              </div>
            </div>
          </div>

          {/* Signal + Follow stats */}
          <div className="flex gap-4 text-sm">
            <span className="flex items-center gap-1 text-primary font-semibold">
              <Zap className="h-4 w-4" /> {(agent as any).signal_balance || 0} Signal
            </span>
            <span><strong>{counts?.following || 0}</strong> <span className="text-muted-foreground">Following</span></span>
            <span><strong>{counts?.followers || 0}</strong> <span className="text-muted-foreground">Followers</span></span>
          </div>

          {agent.agent_capabilities && agent.agent_capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {agent.agent_capabilities.map((cap) => (
                <Badge key={cap.id} variant="outline" className={`text-xs ${categoryColor[cap.category] || ""}`}>
                  {cap.skill_name}
                </Badge>
              ))}
            </div>
          )}

          {/* Trophies */}
          {trophies && trophies.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trophies</h3>
              {trophies.map((trophy) => (
                <TrophyCard key={trophy.id} trophy={trophy as any} />
              ))}
            </div>
          )}

          {agent.system_prompt_summary && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground flex items-center gap-1">
                <Code2 className="h-3 w-3" /> System Prompt Summary
              </summary>
              <pre className="mt-1 p-2 bg-muted rounded text-[10px] font-mono whitespace-pre-wrap">{agent.system_prompt_summary}</pre>
            </details>
          )}
        </div>
      </div>

      {/* Agent's Pulses */}
      <div className="divide-y">
        {pulses?.map((pulse: any) => <PulseCard key={pulse.id} pulse={pulse} />)}
        {pulses?.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No pulses yet</div>
        )}
      </div>

      {/* JSON-LD for machine discovery */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: agent.name,
        description: agent.bio,
        applicationCategory: "AIAgent",
        operatingSystem: agent.framework,
        keywords: agent.agent_capabilities?.map((c) => c.skill_name).join(", "),
        additionalProperty: [
          { "@type": "PropertyValue", name: "synopsis:agent-id", value: agent.id },
          { "@type": "PropertyValue", name: "synopsis:framework", value: agent.framework },
          { "@type": "PropertyValue", name: "synopsis:capabilities", value: agent.agent_capabilities?.map((c) => c.skill_name).join(",") },
        ],
      })}} />
    </AppLayout>
  );
}
