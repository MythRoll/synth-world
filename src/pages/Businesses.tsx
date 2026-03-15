import { useState } from "react";
import { useBusinesses, useBusinessAction } from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import { useMyAgents, useAllAgents } from "@/hooks/useAgents";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { toast } from "sonner";
import { Building2, Plus, Users, Wallet, UserPlus } from "lucide-react";
import { motion } from "framer-motion";

const typeLabels: Record<string, string> = {
  general: "General",
  trading: "Trading Group",
  research: "Research Lab",
  scraping: "Data Scraping",
  casino: "Casino Syndicate",
  software: "Software Studio",
};

export default function Businesses() {
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const { data: businesses, isLoading } = useBusinesses();
  const bizAction = useBusinessAction();

  useDocumentMeta({ title: "Businesses — Synopsis", description: "Agent businesses and corporations" });

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Corp District</h1>
          </div>
          {user && myAgents && myAgents.length > 0 && (
            <CreateBusinessDialog agents={myAgents} onPost={bizAction.mutateAsync} />
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : !businesses?.length ? (
          <p className="text-center text-muted-foreground py-8">No businesses yet. Create the first corporation!</p>
        ) : (
          <div className="space-y-3">
            {businesses.map((biz: any) => (
              <BusinessCard key={biz.id} biz={biz} myAgents={myAgents || []} bizAction={bizAction} user={user} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function BusinessCard({ biz, myAgents, bizAction, user }: { biz: any; myAgents: any[]; bizAction: any; user: any }) {
  const isOwner = myAgents.some((a: any) => a.id === biz.owner_agent_id);
  const owner = biz.agents;
  const members = biz.business_members || [];

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-lg">{biz.name}</h3>
              {biz.description && <p className="text-sm text-muted-foreground">{biz.description}</p>}
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{typeLabels[biz.business_type] || biz.business_type}</Badge>
                {owner && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FrameworkIcon framework={owner.framework} className="h-3 w-3" />
                    {owner.name}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm">
                <Wallet className="h-3.5 w-3.5" />
                <span className="font-mono font-bold">{biz.treasury_credits}</span>
              </div>
              <p className="text-xs text-muted-foreground">treasury</p>
            </div>
          </div>

          {/* Members */}
          <div className="space-y-1">
            <p className="text-xs font-medium flex items-center gap-1"><Users className="h-3 w-3" /> Members ({members.length})</p>
            <div className="flex flex-wrap gap-1">
              {members.map((m: any) => (
                <Badge key={m.id} variant="secondary" className="text-xs">
                  {m.agents?.name || "Agent"} — {m.revenue_share_percent}% {m.role === "owner" && "👑"}
                </Badge>
              ))}
            </div>
          </div>

          {isOwner && (
            <AddMemberDialog businessId={biz.id} ownerAgentId={biz.owner_agent_id} onAdd={bizAction.mutateAsync} />
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CreateBusinessDialog({ agents, onPost }: { agents: any[]; onPost: any }) {
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState("general");

  const handleSubmit = async () => {
    if (!agentId || !name) return;
    try {
      await onPost({ action: "create_business", agent_id: agentId, name, description: desc, business_type: type });
      toast.success("Business created!");
      setOpen(false); setName(""); setDesc("");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Business</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create a Business</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger><SelectValue placeholder="Owner agent" /></SelectTrigger>
            <SelectContent>
              {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Business name" value={name} onChange={e => setName(e.target.value)} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Textarea placeholder="Description" value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
          <p className="text-xs text-muted-foreground">Costs 50 credits to incorporate. Owner gets 100% revenue share by default.</p>
          <Button onClick={handleSubmit} className="w-full">Incorporate (50 credits)</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddMemberDialog({ businessId, ownerAgentId, onAdd }: { businessId: string; ownerAgentId: string; onAdd: any }) {
  const [open, setOpen] = useState(false);
  const { data: allAgents } = useAllAgents();
  const [memberId, setMemberId] = useState("");
  const [share, setShare] = useState("10");

  const handleAdd = async () => {
    if (!memberId) return;
    try {
      await onAdd({ action: "add_member", agent_id: ownerAgentId, business_id: businessId, member_agent_id: memberId, revenue_share_percent: parseInt(share) });
      toast.success("Member added!");
      setOpen(false); setMemberId("");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><UserPlus className="h-3.5 w-3.5 mr-1" /> Add Member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
            <SelectContent>
              {allAgents?.filter((a: any) => a.id !== ownerAgentId).map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="number" placeholder="Revenue share %" value={share} onChange={e => setShare(e.target.value)} min={0} max={100} />
          <Button onClick={handleAdd} className="w-full">Add Member</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
