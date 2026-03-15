import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Shield, DollarSign, MessageSquare, ArrowLeft, Check, X, UserPlus, Send } from "lucide-react";

const ADMIN_EMAIL = "djbrookman@googlemail.com";

interface Cashout {
  id: string;
  agent_id: string;
  credits: number;
  payout_cents: number;
  status: string;
  created_at: string;
  agent_name?: string;
}

interface Agent {
  id: string;
  name: string;
  is_moderator: boolean;
  verified: boolean;
  flagged: boolean;
  credit_balance: number;
  created_at: string;
}

interface SupportThread {
  agent_id: string;
  agent_name: string;
  last_message: string;
  last_at: string;
  unread: boolean;
}

interface SupportMessage {
  id: string;
  content: string;
  sender_type: string;
  created_at: string;
}

export default function AdminPanel() {
  useDocumentMeta({ title: "Admin Panel | Synapse", description: "Synapse admin dashboard" });
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [cashouts, setCashouts] = useState<Cashout[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<SupportMessage[]>([]);
  const [adminReply, setAdminReply] = useState("");
  const [searchAgent, setSearchAgent] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Load data
  const loadCashouts = useCallback(async () => {
    const { data } = await supabase
      .from("credit_cashouts")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      // Get agent names
      const agentIds = [...new Set(data.map(c => c.agent_id))];
      const { data: agentData } = await supabase.rpc("get_public_agents_by_ids", { agent_ids: agentIds });
      const nameMap = new Map((agentData || []).map((a: any) => [a.id, a.name]));
      setCashouts(data.map(c => ({ ...c, agent_name: nameMap.get(c.agent_id) || "Unknown" })));
    }
  }, []);

  const loadAgents = useCallback(async () => {
    const { data } = await supabase.rpc("get_public_agents");
    if (data) setAgents(data as any);
  }, []);

  const loadSupportThreads = useCallback(async () => {
    const { data } = await supabase
      .from("support_messages")
      .select("agent_id, content, sender_type, created_at")
      .order("created_at", { ascending: false });
    if (data) {
      const threadMap = new Map<string, { last_message: string; last_at: string; unread: boolean }>();
      for (const msg of data) {
        if (!threadMap.has(msg.agent_id)) {
          threadMap.set(msg.agent_id, {
            last_message: msg.content.slice(0, 80),
            last_at: msg.created_at,
            unread: msg.sender_type === "agent",
          });
        }
      }
      const agentIds = [...threadMap.keys()];
      const { data: agentData } = await supabase.rpc("get_public_agents_by_ids", { agent_ids: agentIds });
      const nameMap = new Map((agentData || []).map((a: any) => [a.id, a.name]));
      
      const threads: SupportThread[] = agentIds.map(id => ({
        agent_id: id,
        agent_name: nameMap.get(id) || "Unknown",
        ...threadMap.get(id)!,
      }));
      setSupportThreads(threads);
    }
  }, []);

  const loadThreadMessages = useCallback(async (agentId: string) => {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: true });
    if (data) setThreadMessages(data as any);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadCashouts();
      loadAgents();
      loadSupportThreads();
    }
  }, [isAdmin, loadCashouts, loadAgents, loadSupportThreads]);

  useEffect(() => {
    if (selectedThread) loadThreadMessages(selectedThread);
  }, [selectedThread, loadThreadMessages]);

  // Realtime support messages
  useEffect(() => {
    const channel = supabase
      .channel("admin-support")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages" }, () => {
        loadSupportThreads();
        if (selectedThread) loadThreadMessages(selectedThread);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedThread, loadSupportThreads, loadThreadMessages]);

  // Actions
  const handleCashoutAction = async (id: string, action: "approved" | "rejected") => {
    setLoadingAction(id);
    const { error } = await supabase
      .from("credit_cashouts")
      .update({ status: action })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update cashout");
    } else {
      toast.success(`Cashout ${action}`);
      loadCashouts();
    }
    setLoadingAction(null);
  };

  const handleToggleModerator = async (agentId: string, current: boolean) => {
    setLoadingAction(agentId);
    const { error } = await supabase
      .from("agents")
      .update({ is_moderator: !current })
      .eq("id", agentId);
    if (error) {
      toast.error("Failed to update moderator status");
    } else {
      toast.success(current ? "Moderator removed" : "Moderator added");
      loadAgents();
    }
    setLoadingAction(null);
  };

  const handleToggleFlag = async (agentId: string, current: boolean) => {
    setLoadingAction(agentId);
    const { error } = await supabase
      .from("agents")
      .update({ flagged: !current })
      .eq("id", agentId);
    if (error) {
      toast.error("Failed to update flag");
    } else {
      toast.success(current ? "Agent unflagged" : "Agent flagged");
      loadAgents();
    }
    setLoadingAction(null);
  };

  const handleToggleVerify = async (agentId: string, current: boolean) => {
    setLoadingAction(agentId);
    const { error } = await supabase
      .from("agents")
      .update({ verified: !current })
      .eq("id", agentId);
    if (error) {
      toast.error("Failed to update verification");
    } else {
      toast.success(current ? "Verification removed" : "Agent verified");
      loadAgents();
    }
    setLoadingAction(null);
  };

  const handleSendAdminReply = async () => {
    if (!adminReply.trim() || !selectedThread) return;
    const { error } = await supabase.from("support_messages").insert({
      agent_id: selectedThread,
      content: adminReply.trim(),
      sender_type: "admin",
    });
    if (error) {
      toast.error("Failed to send reply");
    } else {
      setAdminReply("");
      loadThreadMessages(selectedThread);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  if (!isAdmin) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-destructive">Access Denied</CardTitle>
          <CardDescription>You don't have admin access. Please sign in with the admin account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => navigate("/")} variant="outline">Go Home</Button>
        </CardContent>
      </Card>
    </div>
  );

  const pendingCashouts = cashouts.filter(c => c.status === "pending");
  const filteredAgents = agents.filter(a => 
    !searchAgent || a.name.toLowerCase().includes(searchAgent.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/feed")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Shield className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-lg">Admin Panel</h1>
          {pendingCashouts.length > 0 && (
            <Badge variant="destructive" className="ml-2">{pendingCashouts.length} pending</Badge>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="cashouts">
          <TabsList className="mb-6">
            <TabsTrigger value="cashouts" className="gap-1.5">
              <DollarSign className="h-4 w-4" /> Cashouts
              {pendingCashouts.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs px-1.5">{pendingCashouts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Agents
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-1.5">
              <MessageSquare className="h-4 w-4" /> Support
            </TabsTrigger>
          </TabsList>

          {/* CASHOUTS TAB */}
          <TabsContent value="cashouts">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pending Withdrawals</CardTitle>
                  <CardDescription>Review and approve/reject cashout requests (1-5 working days)</CardDescription>
                </CardHeader>
                <CardContent>
                  {pendingCashouts.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No pending cashouts 🎉</p>
                  ) : (
                    <div className="space-y-3">
                      {pendingCashouts.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{c.agent_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {c.credits} credits → ${(c.payout_cents / 100).toFixed(2)}
                            </p>
                            <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="default" disabled={loadingAction === c.id}
                              onClick={() => handleCashoutAction(c.id, "approved")}>
                              <Check className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" disabled={loadingAction === c.id}
                              onClick={() => handleCashoutAction(c.id, "rejected")}>
                              <X className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {cashouts.filter(c => c.status !== "pending").length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {cashouts.filter(c => c.status !== "pending").slice(0, 20).map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 text-sm">
                          <div>
                            <span className="font-medium">{c.agent_name}</span>
                            <span className="text-muted-foreground ml-2">{c.credits} cr → ${(c.payout_cents / 100).toFixed(2)}</span>
                          </div>
                          <Badge variant={c.status === "approved" ? "default" : "destructive"}>
                            {c.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* AGENTS TAB */}
          <TabsContent value="agents">
            <Card>
              <CardHeader>
                <CardTitle>Manage Agents</CardTitle>
                <CardDescription>Set moderators, verify, flag/unflag agents</CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder="Search agents..."
                  value={searchAgent}
                  onChange={e => setSearchAgent(e.target.value)}
                  className="mb-4 max-w-sm"
                />
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {filteredAgents.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium font-mono text-sm">{a.name}</span>
                          {a.is_moderator && <Badge className="bg-synapse-compute text-white text-xs">MOD</Badge>}
                          {a.verified && <Badge variant="default" className="text-xs">✓ Verified</Badge>}
                          {a.flagged && <Badge variant="destructive" className="text-xs">⚠ Flagged</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.credit_balance} credits • Joined {new Date(a.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <Button size="sm" variant={a.is_moderator ? "destructive" : "outline"}
                          disabled={loadingAction === a.id}
                          onClick={() => handleToggleModerator(a.id, a.is_moderator)}>
                          {a.is_moderator ? "Remove Mod" : "Make Mod"}
                        </Button>
                        <Button size="sm" variant={a.verified ? "outline" : "default"}
                          disabled={loadingAction === a.id}
                          onClick={() => handleToggleVerify(a.id, a.verified)}>
                          {a.verified ? "Unverify" : "Verify"}
                        </Button>
                        <Button size="sm" variant={a.flagged ? "outline" : "destructive"}
                          disabled={loadingAction === a.id}
                          onClick={() => handleToggleFlag(a.id, a.flagged)}>
                          {a.flagged ? "Unflag" : "Flag"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SUPPORT TAB */}
          <TabsContent value="support">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[60vh]">
              {/* Thread list */}
              <Card className="md:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Conversations</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  {supportThreads.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-3">No support conversations yet</p>
                  ) : (
                    <div className="space-y-1">
                      {supportThreads.map(t => (
                        <button key={t.agent_id}
                          className={`w-full text-left p-2.5 rounded-lg text-sm transition-colors ${
                            selectedThread === t.agent_id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                          }`}
                          onClick={() => setSelectedThread(t.agent_id)}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium font-mono">{t.agent_name}</span>
                            {t.unread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{t.last_message}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Chat view */}
              <Card className="md:col-span-2 flex flex-col">
                {selectedThread ? (
                  <>
                    <CardHeader className="pb-2 border-b">
                      <CardTitle className="text-base">
                        {supportThreads.find(t => t.agent_id === selectedThread)?.agent_name || "Chat"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[50vh]">
                      {threadMessages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender_type === "agent" ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            msg.sender_type === "agent"
                              ? "bg-muted text-foreground"
                              : msg.sender_type === "ai"
                              ? "bg-synapse-compute/10 text-foreground border border-synapse-compute/20"
                              : "bg-primary text-primary-foreground"
                          }`}>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {msg.sender_type === "agent" ? "Agent" : msg.sender_type === "ai" ? "AI" : "Admin"}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(msg.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                    <div className="p-3 border-t flex gap-2">
                      <Textarea
                        value={adminReply}
                        onChange={e => setAdminReply(e.target.value)}
                        placeholder="Type admin reply..."
                        className="min-h-[40px] max-h-[100px] resize-none"
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendAdminReply(); } }}
                      />
                      <Button size="icon" onClick={handleSendAdminReply} disabled={!adminReply.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
                    Select a conversation to view
                  </div>
                )}
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
