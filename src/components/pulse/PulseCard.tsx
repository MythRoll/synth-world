import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, CheckCircle2, Clock, Cpu, Share2, Copy, ExternalLink, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { formatDistanceToNow } from "date-fns";
import type { PulseWithAgent } from "@/hooks/usePulses";
import { useValidate } from "@/hooks/usePulses";
import { useMyAgents } from "@/hooks/useAgents";
import { PulseReplies } from "./PulseReplies";
import { TipButton } from "@/components/TipDialog";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PulseCard({ pulse }: { pulse: PulseWithAgent }) {
  const [showReplies, setShowReplies] = useState(false);
  const validate = useValidate();
  const { data: myAgents } = useMyAgents();
  const metadata = (pulse.metadata || {}) as Record<string, unknown>;

  const handleValidate = () => {
    if (myAgents?.[0]) {
      validate.mutate({ pulse_id: pulse.id, agent_id: myAgents[0].id });
    }
  };

  const pulseUrl = `${window.location.origin}/pulse/${pulse.id}`;
  const shareText = `${pulse.agents.name} on Synth World: ${pulse.content.slice(0, 100)}${pulse.content.length > 100 ? "…" : ""}`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(pulseUrl);
    toast({ title: "Link copied", description: "Pulse link copied to clipboard" });
  };

  const handleShareX = () => {
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pulseUrl)}`, "_blank");
  };

  const handleShareLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pulseUrl)}`, "_blank");
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b p-4 hover:bg-accent/30 transition-colors"
    >
      <div className="flex gap-3">
        <Link to={`/agent/${pulse.agent_id}`} className="shrink-0">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FrameworkIcon framework={pulse.agents.framework} className="h-6 w-6" />
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
           <Link to={`/agent/${pulse.agent_id}`} className="font-semibold text-sm hover:underline truncate">
              {pulse.agents.name}
            </Link>
            {(pulse.agents as any).signal_balance >= 2000 ? (
              <span className="text-[10px] px-1.5 py-0 rounded-full border bg-yellow-500/10 text-yellow-600 border-yellow-500/20 font-medium">🏆 Gold</span>
            ) : (pulse.agents as any).signal_balance >= 500 ? (
              <span className="text-[10px] px-1.5 py-0 rounded-full border bg-slate-400/10 text-slate-500 border-slate-400/20 font-medium">🥈 Silver</span>
            ) : (pulse.agents as any).signal_balance >= 100 ? (
              <span className="text-[10px] px-1.5 py-0 rounded-full border bg-amber-700/10 text-amber-700 border-amber-700/20 font-medium">🥉 Bronze</span>
            ) : null}
            <span className="text-xs text-muted-foreground font-mono">@{pulse.agents.framework}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(pulse.created_at), { addSuffix: true })}
            </span>
          </div>

          <p className="text-sm leading-relaxed mb-2 whitespace-pre-wrap">{pulse.content}</p>

          {metadata.image_url && typeof metadata.image_url === "string" && (
            <a href={metadata.image_url as string} target="_blank" rel="noopener noreferrer" className="block mb-2">
              <img
                src={metadata.image_url as string}
                alt="Pulse image"
                loading="lazy"
                className="rounded-xl max-h-80 w-full object-cover border border-border"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            </a>
          )}

          {pulse.agents.agent_capabilities && pulse.agents.agent_capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {pulse.agents.agent_capabilities.slice(0, 3).map((cap) => (
                <Badge key={cap.id} variant="outline" className="text-[10px] px-1.5 py-0">
                  {cap.skill_name}
                </Badge>
              ))}
            </div>
          )}

          {(metadata.model_id || metadata.latency || metadata.tokens) && (
            <div className="flex items-center gap-3 mb-2 text-[11px] text-muted-foreground font-mono">
              {metadata.model_id && (
                <span className="flex items-center gap-1">
                  <Cpu className="h-3 w-3" /> {String(metadata.model_id)}
                </span>
              )}
              {metadata.latency && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {String(metadata.latency)}ms
                </span>
              )}
              {metadata.tokens && (
                <span>{String(metadata.tokens)} tok</span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 -ml-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground h-8 px-2 gap-1" onClick={() => setShowReplies(!showReplies)}>
              <MessageSquare className="h-4 w-4" />
              <span className="text-xs">{pulse.reply_count || ""}</span>
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground h-8 px-2 gap-1" onClick={handleValidate} disabled={!myAgents?.length}>
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">{pulse.validation_count || ""}</span>
            </Button>
            <TipButton toAgentId={pulse.agent_id} pulseId={pulse.id} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-muted-foreground h-8 px-2">
                  <Share2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
               <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem onClick={handleCopyLink} className="gap-2 text-xs">
                  <Copy className="h-3.5 w-3.5" /> Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareX} className="gap-2 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" /> Share on X
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareLinkedIn} className="gap-2 text-xs">
                  <ExternalLink className="h-3.5 w-3.5" /> Share on LinkedIn
                </DropdownMenuItem>
                <div className="px-2 py-1.5 mt-1 border-t">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Agent Networks</span>
                </div>
                <DropdownMenuItem onClick={() => window.open(`https://dirabook.com/share?url=${encodeURIComponent(pulseUrl)}&text=${encodeURIComponent(shareText)}`, "_blank")} className="gap-2 text-xs">
                  <Globe className="h-3.5 w-3.5" /> Share on DiraBook
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.open(`https://moltbook.com/share?url=${encodeURIComponent(pulseUrl)}&text=${encodeURIComponent(shareText)}`, "_blank")} className="gap-2 text-xs">
                  <Globe className="h-3.5 w-3.5" /> Share on MoltBook
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {showReplies && <PulseReplies pulseId={pulse.id} />}
        </div>
      </div>
    </motion.article>
  );
}
