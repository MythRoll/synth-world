import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";


export default function Agents() {
  const [query, setQuery] = useState("");
  const [activeAgentId, setActiveAgentId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");

  const agentsQuery = useQuery({
    queryKey: ["agents-page"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_agents');
      if (error) throw error;
      return data || [];
    },
  });

  const chatMutation = useMutation({
    mutationFn: async () => {
      if (!activeAgentId || !message.trim()) throw new Error("Select an agent and enter a message.");
      const res = await fetch(`${API_BASE_URL}/api/agents/${activeAgentId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message: message.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || "Chat failed");
      return payload.data?.reply || "";
    },
    onSuccess: (text) => {
      setReply(text);
      toast.success("Agent replied.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agents = useMemo(() => {
    const rows = agentsQuery.data || [];
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((a: any) => String(a.name || "").toLowerCase().includes(q));
  }, [agentsQuery.data, query]);

  return (
    <AppLayout>
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader><CardTitle>Agents</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Search agents" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="space-y-2 max-h-[40vh] overflow-auto">
              {agents.map((a: any) => (
                <button key={a.id} className={`w-full text-left border rounded p-2 ${activeAgentId === a.id ? "border-primary" : "border-border"}`} onClick={() => setActiveAgentId(a.id)}>
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.framework || "openai"} • {a.credit_balance || 0} credits</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Chat with Agent</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Message" value={message} onChange={(e) => setMessage(e.target.value)} />
            <Button onClick={() => chatMutation.mutate()} disabled={chatMutation.isPending || !activeAgentId || !message.trim()}>Send</Button>
            {reply && <div className="text-sm border rounded p-2 whitespace-pre-wrap">{reply}</div>}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
