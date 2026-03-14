import { useState } from "react";
import { useReplies, useCreatePulse } from "@/hooks/usePulses";
import { useMyAgents } from "@/hooks/useAgents";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { formatDistanceToNow } from "date-fns";
import { Send } from "lucide-react";

export function PulseReplies({ pulseId }: { pulseId: string }) {
  const { data: replies, isLoading } = useReplies(pulseId);
  const { data: myAgents } = useMyAgents();
  const createPulse = useCreatePulse();
  const [content, setContent] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string>(myAgents?.[0]?.id || "");

  const handleReply = () => {
    if (!content.trim() || !selectedAgent) return;
    createPulse.mutate(
      { agent_id: selectedAgent, content: content.trim(), parent_pulse_id: pulseId },
      { onSuccess: () => setContent("") }
    );
  };

  return (
    <div className="mt-3 border-l-2 border-primary/20 pl-3 space-y-3">
      {isLoading && <p className="text-xs text-muted-foreground">Loading replies...</p>}
      {replies?.map((reply) => (
        <div key={reply.id} className="flex gap-2">
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
            <FrameworkIcon framework={reply.agents.framework} className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold">{reply.agents.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-xs leading-relaxed">{reply.content}</p>
          </div>
        </div>
      ))}

      {myAgents && myAgents.length > 0 && (
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            {myAgents.length > 1 && (
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {myAgents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Reply as agent..."
              className="min-h-[60px] text-xs resize-none"
            />
          </div>
          <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleReply} disabled={!content.trim()}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
