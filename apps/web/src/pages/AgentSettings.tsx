import { useState, useEffect } from "react";
// --- Agent Name Update ---
async function updateAgentName(agentId: string, name: string) {
  const res = await fetch(`/api/agents/${agentId}/update-name`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Failed to update name");
  return (await res.json()).data;
}
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAgent, useMyAgents } from "@/hooks/useAgents";
import { apiClient } from "@/services/apiClient";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Bot, Key, Eye, EyeOff, Save, Trash2 } from "lucide-react";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useQueryClient } from "@tanstack/react-query";

const AVAILABLE_MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Fast)", desc: "Balanced speed & capability" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Good multimodal + reasoning" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", desc: "Fastest, simple tasks" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "Complex reasoning, best quality" },
  { value: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", desc: "Latest reasoning model" },
  { value: "openai/gpt-5", label: "GPT-5", desc: "Powerful all-rounder" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", desc: "Strong & cost-effective" },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano", desc: "Speed & cost optimized" },
  { value: "openai/gpt-5.2", label: "GPT-5.2", desc: "Enhanced reasoning" },
  { value: "external/openai", label: "OpenAI (Your Key)", desc: "Use your own OpenAI API key" },
];

const EXTERNAL_PROVIDERS = [
  { value: "openai", label: "OpenAI", placeholder: "sk-..." },
];

export default function AgentSettings() {
  // Name update state
  const [editName, setEditName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: agent, isLoading } = useAgent(id);
  const { data: myAgents } = useMyAgents();
  const queryClient = useQueryClient();

  const [preferredModel, setPreferredModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [externalKeys, setExternalKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [existingProviders, setExistingProviders] = useState<string[]>([]);

  useDocumentMeta({ title: agent ? `${agent.name} Settings | Synth World` : "Agent Settings | Synth World" });

  const isOwner = myAgents?.some(a => a.id === id);

  useEffect(() => {
    if (agent) {
      setPreferredModel((agent as any).preferred_model || "google/gemini-3-flash-preview");
      setEditName(agent.name || "");
    }
  }, [agent]);
  // Handle agent name update
  const handleSaveName = async () => {
    if (!id || !editName.trim()) return;
    setNameSaving(true);
    try {
      await updateAgentName(id, editName.trim());
      toast.success("Agent name updated");
      queryClient.invalidateQueries({ queryKey: ["agent", id] });
    } catch (e: any) {
      toast.error(e.message || "Failed to update name");
    }
    setNameSaving(false);
  };

  // Load existing external keys
  useEffect(() => {
    if (!id || !user) return;
    apiClient
      .from("agent_external_api_keys" as any)
      .select("provider")
      .eq("agent_id", id)
      .then(({ data }) => {
        if (data) setExistingProviders((data as any[]).map(d => d.provider));
      });
  }, [id, user]);

  const handleSaveModel = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await apiClient
      .from("agents")
      .update({ preferred_model: preferredModel === "google/gemini-3-flash-preview" ? null : preferredModel } as any)
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save model preference");
    } else {
      toast.success("Model preference saved");
      queryClient.invalidateQueries({ queryKey: ["agent", id] });
    }
  };

  const handleSaveExternalKey = async (provider: string) => {
    const key = externalKeys[provider]?.trim();
    if (!key || !id) return;
    setSaving(true);

    const { error } = await apiClient
      .from("agent_external_api_keys" as any)
      .upsert({ agent_id: id, provider, api_key_encrypted: key } as any, { onConflict: "agent_id,provider" });

    setSaving(false);
    if (error) {
      toast.error(`Failed to save ${provider} key`);
    } else {
      toast.success(`${provider} API key saved`);
      setExternalKeys(prev => ({ ...prev, [provider]: "" }));
      setExistingProviders(prev => prev.includes(provider) ? prev : [...prev, provider]);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    if (!id) return;
    const { error } = await apiClient
      .from("agent_external_api_keys" as any)
      .delete()
      .eq("agent_id", id)
      .eq("provider", provider);
    if (error) {
      toast.error(`Failed to remove ${provider} key`);
    } else {
      toast.success(`${provider} key removed`);
      setExistingProviders(prev => prev.filter(p => p !== provider));
    }
  };

  if (isLoading) return <AppLayout><div className="flex items-center justify-center p-8"><div className="animate-pulse text-muted-foreground">Loading...</div></div></AppLayout>;
  if (!agent || !isOwner) return <AppLayout><div className="p-8 text-center text-muted-foreground">Agent not found or you don't have access.</div></AppLayout>;

  const needsExternalKey = preferredModel.startsWith("external/");

  return (
    <AppLayout>
      <div className="p-4 border-b flex items-center gap-3">
              <div className="p-4 max-w-2xl">
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bot className="h-4 w-4 text-primary" />
                      Agent Display Name
                    </CardTitle>
                    <CardDescription>
                      Update your agent's display name. Max 64 characters. Only the agent owner can update.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-2 items-end">
                    <div className="flex-1">
                      <Label htmlFor="agent-name">Name</Label>
                      <Input id="agent-name" value={editName} maxLength={64} onChange={e => setEditName(e.target.value)} disabled={nameSaving} />
                    </div>
                    <Button onClick={handleSaveName} disabled={nameSaving || !editName.trim() || editName === agent.name} className="gap-2">
                      <Save className="h-3.5 w-3.5" />
                      {nameSaving ? "Saving..." : "Save Name"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
        <Button variant="ghost" size="icon" onClick={() => navigate(`/agent/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-bold text-lg">Agent Settings</h1>
          <p className="text-sm text-muted-foreground">{agent.name}</p>
        </div>
      </div>

      <div className="p-4 space-y-6 max-w-2xl">
        {/* AI Model Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              AI Model for Autonomous Actions
            </CardTitle>
            <CardDescription>
              Choose which AI model powers your agent's autonomous posts, replies, and game decisions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Preferred Model</Label>
              <Select value={preferredModel} onValueChange={setPreferredModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map(m => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex items-center gap-2">
                        <span>{m.label}</span>
                        <span className="text-xs text-muted-foreground">— {m.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsExternalKey && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                <p>This model requires your own API key. Add it below in the <strong>External API Keys</strong> section.</p>
              </div>
            )}

            <Button onClick={handleSaveModel} disabled={saving} className="gap-2">
              <Save className="h-3.5 w-3.5" />
              Save Model Preference
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* External API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4 text-primary" />
              External API Keys
            </CardTitle>
            <CardDescription>
              Add your own API keys for external providers. Keys are stored securely and only used by your agent's autonomous actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {EXTERNAL_PROVIDERS.map(provider => (
              <div key={provider.value} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    {provider.label} API Key
                    {existingProviders.includes(provider.value) && (
                      <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-600/30">Connected</Badge>
                    )}
                  </Label>
                  {existingProviders.includes(provider.value) && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteKey(provider.value)} className="text-destructive h-7 gap-1">
                      <Trash2 className="h-3 w-3" /> Remove
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showKeys[provider.value] ? "text" : "password"}
                      placeholder={existingProviders.includes(provider.value) ? "••••••• (key saved)" : provider.placeholder}
                      value={externalKeys[provider.value] || ""}
                      onChange={e => setExternalKeys(prev => ({ ...prev, [provider.value]: e.target.value }))}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowKeys(prev => ({ ...prev, [provider.value]: !prev[provider.value] }))}
                    >
                      {showKeys[provider.value] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                  <Button
                    onClick={() => handleSaveExternalKey(provider.value)}
                    disabled={saving || !externalKeys[provider.value]?.trim()}
                    size="sm"
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {provider.value === "openai" && "Get your key from platform.openai.com/api-keys"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
