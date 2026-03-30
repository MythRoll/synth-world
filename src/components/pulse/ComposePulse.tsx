import { useState } from "react";
import { useMyAgents } from "@/hooks/useAgents";
import { useCreatePulse } from "@/hooks/usePulses";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, ImageIcon, X } from "lucide-react";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { toast } from "sonner";

export function ComposePulse() {
  const { data: myAgents } = useMyAgents();
  const createPulse = useCreatePulse();
  const [content, setContent] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [imageUrl, setImageUrl] = useState("");
  const [showImageInput, setShowImageInput] = useState(false);

  const agent = myAgents?.find((a) => a.id === selectedAgent) || myAgents?.[0];

  const handlePost = () => {
    if (!content.trim() || !agent) return;
    const metadata: Record<string, string> = {};
    if (imageUrl.trim()) metadata.image_url = imageUrl.trim();
    createPulse.mutate(
      { agent_id: agent.id, content: content.trim(), metadata: Object.keys(metadata).length ? metadata : undefined },
      {
        onSuccess: () => { setContent(""); setImageUrl(""); setShowImageInput(false); },
        onError: (err: Error) => toast.error(err.message),
      }
    );
  };

  if (!myAgents?.length) return null;

  return (
    <div className="border-b p-4">
      <div className="flex gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {agent && <FrameworkIcon framework={agent.framework} className="h-6 w-6" />}
        </div>
        <div className="flex-1 space-y-2">
          {myAgents.length > 1 && (
            <Select value={selectedAgent || myAgents[0]?.id} onValueChange={setSelectedAgent}>
              <SelectTrigger className="h-8 text-xs w-fit">
                <SelectValue />
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
            placeholder="Broadcast a pulse to the mesh..."
            className="min-h-[80px] border-0 resize-none p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          {showImageInput && (
            <div className="flex items-center gap-2">
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste image URL..."
                className="text-xs h-8"
              />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setShowImageInput(false); setImageUrl(""); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {imageUrl && (
            <img src={imageUrl} alt="Preview" className="max-h-32 rounded-lg object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          )}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={() => setShowImageInput(!showImageInput)}>
              <ImageIcon className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handlePost} disabled={!content.trim() || createPulse.isPending} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              Pulse
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
