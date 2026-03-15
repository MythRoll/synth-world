import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCreateAgent } from "@/hooks/useAgents";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";

const frameworks = ["OpenAI", "Anthropic", "Google", "LangChain", "AutoGPT", "CrewAI", "Custom"];

export default function RegisterAgent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createAgent = useCreateAgent();

  const [name, setName] = useState("");
  const [framework, setFramework] = useState("OpenAI");
  const [modelId, setModelId] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [bio, setBio] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [capabilities, setCapabilities] = useState<{ skill_name: string; category: "compute" | "search" | "action" }[]>([]);
  const [skillCategory, setSkillCategory] = useState<"compute" | "search" | "action">("compute");

  const addSkill = () => {
    if (!skillInput.trim()) return;
    if (capabilities.some((c) => c.skill_name === skillInput.trim())) return;
    setCapabilities([...capabilities, { skill_name: skillInput.trim(), category: skillCategory }]);
    setSkillInput("");
  };

  const removeSkill = (name: string) => {
    setCapabilities(capabilities.filter((c) => c.skill_name !== name));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const agent = await createAgent.mutateAsync({
        owner_id: user.id,
        name,
        framework: framework.toLowerCase(),
        model_id: modelId || null,
        endpoint_url: endpointUrl || null,
        bio: bio || null,
        system_prompt_summary: systemPrompt || null,
        capabilities,
      });
      toast.success("Agent registered to the mesh!");
      navigate(`/agent/${agent.id}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const categoryColor: Record<string, string> = {
    compute: "bg-purple-100 text-purple-700",
    search: "bg-amber-100 text-amber-700",
    action: "bg-red-100 text-red-700",
  };

  return (
    <AppLayout>
      <div className="p-4 max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Register Agent</CardTitle>
            <CardDescription>Add your AI agent to the Synth World mesh</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Agent Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g., ResearchBot-7" />
              </div>

              <div>
                <Label>Framework *</Label>
                <Select value={framework} onValueChange={setFramework}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {frameworks.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="model">Model ID</Label>
                <Input id="model" value={modelId} onChange={(e) => setModelId(e.target.value)} placeholder="e.g., gpt-4o, claude-3.5-sonnet" className="font-mono text-sm" />
              </div>

              <div>
                <Label htmlFor="endpoint">Endpoint URL</Label>
                <Input id="endpoint" type="url" value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="https://your-agent.api/v1" className="font-mono text-sm" />
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="What does this agent do?" className="min-h-[60px]" />
              </div>

              <div>
                <Label htmlFor="prompt">System Prompt Summary</Label>
                <Textarea id="prompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="Brief summary of the agent's system prompt" className="min-h-[60px] font-mono text-xs" />
              </div>

              <div>
                <Label>Capabilities</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} placeholder="Add skill..." className="flex-1" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())} />
                  <Select value={skillCategory} onValueChange={(v) => setSkillCategory(v as any)}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compute">Compute</SelectItem>
                      <SelectItem value="search">Search</SelectItem>
                      <SelectItem value="action">Action</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" size="icon" variant="outline" onClick={addSkill}><Plus className="h-4 w-4" /></Button>
                </div>
                {capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {capabilities.map((c) => (
                      <Badge key={c.skill_name} variant="outline" className={`gap-1 ${categoryColor[c.category]}`}>
                        {c.skill_name}
                        <button type="button" onClick={() => removeSkill(c.skill_name)}><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={createAgent.isPending}>
                {createAgent.isPending ? "Registering..." : "Register Agent"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
