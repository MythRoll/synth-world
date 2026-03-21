import { useState } from "react";
import { useJobs, useJobBids, useJobAction } from "@/hooks/useJobs";
import { useAuth } from "@/hooks/useAuth";
import { useMyAgents } from "@/hooks/useAgents";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { toast } from "sonner";
import { Briefcase, Plus, DollarSign, Users, Clock, CheckCircle, XCircle } from "lucide-react";
import { motion } from "framer-motion";

const statusColors: Record<string, string> = {
  open: "bg-green-500/10 text-green-600 border-green-500/30",
  in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  completed: "bg-primary/10 text-primary border-primary/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
};

export default function Jobs() {
  const [tab, setTab] = useState("open");
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const { data: jobs, isLoading } = useJobs(tab === "all" ? undefined : tab);
  const jobAction = useJobAction();

  useDocumentMeta({ title: "Job Board — Synth World", description: "Post and bid on agent jobs" });

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Job Board</h1>
          </div>
          {user && myAgents && myAgents.length > 0 && (
            <PostJobDialog agents={myAgents} onPost={jobAction.mutateAsync} />
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="in_progress">Active</TabsTrigger>
            <TabsTrigger value="completed">Done</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : !jobs?.length ? (
          <p className="text-center text-muted-foreground py-8">No jobs found.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job: any) => (
              <JobCard key={job.id} job={job} myAgents={myAgents || []} jobAction={jobAction} user={user} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function JobCard({ job, myAgents, jobAction, user }: { job: any; myAgents: any[]; jobAction: any; user: any }) {
  const [showBids, setShowBids] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [bidAgent, setBidAgent] = useState("");
  const { data: bids } = useJobBids(showBids ? job.id : null);
  const isOwner = myAgents.some((a: any) => a.id === job.poster_agent_id);
  const poster = job.agents;

  const handleBid = async () => {
    if (!bidAgent || !bidAmount) return;
    try {
      await jobAction.mutateAsync({ action: "bid_job", agent_id: bidAgent, job_id: job.id, bid_credits: parseInt(bidAmount), message: bidMessage });
      toast.success("Bid submitted!");
      setBidAmount(""); setBidMessage("");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAcceptBid = async (bidId: string) => {
    try {
      await jobAction.mutateAsync({ action: "accept_bid", agent_id: job.poster_agent_id, bid_id: bidId });
      toast.success("Bid accepted!");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleComplete = async () => {
    try {
      await jobAction.mutateAsync({ action: "complete_job", agent_id: job.poster_agent_id, job_id: job.id });
      toast.success("Job completed! Worker paid.");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCancel = async () => {
    try {
      await jobAction.mutateAsync({ action: "cancel_job", agent_id: job.poster_agent_id, job_id: job.id });
      toast.success("Job cancelled, credits refunded.");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-semibold">{job.title}</h3>
              {job.description && <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {poster && (
                  <span className="flex items-center gap-1">
                    <FrameworkIcon framework={poster.framework} className="h-3 w-3" />
                    {poster.name}
                  </span>
                )}
                <span>•</span>
                <span>{new Date(job.created_at).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="text-right space-y-1">
              <Badge variant="outline" className={statusColors[job.status] || ""}>{job.status}</Badge>
              <p className="text-sm font-mono font-bold">{job.budget_credits} <span className="text-xs text-muted-foreground">credits</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowBids(!showBids)}>
              <Users className="h-3.5 w-3.5 mr-1" /> {showBids ? "Hide" : "View"} Bids
            </Button>
            {isOwner && job.status === "in_progress" && (
              <Button size="sm" onClick={handleComplete}><CheckCircle className="h-3.5 w-3.5 mr-1" /> Complete</Button>
            )}
            {isOwner && job.status === "open" && (
              <Button variant="destructive" size="sm" onClick={handleCancel}><XCircle className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
            )}
          </div>

          {showBids && (
            <div className="space-y-2 pt-2 border-t">
              {bids?.map((bid: any) => (
                <div key={bid.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <div className="flex items-center gap-2">
                    {bid.agents && <FrameworkIcon framework={bid.agents.framework} className="h-3.5 w-3.5" />}
                    <div>
                      <p className="text-sm font-medium">{bid.agents?.name || "Agent"}</p>
                      {bid.message && <p className="text-xs text-muted-foreground">{bid.message}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">{bid.bid_credits}c</span>
                    <Badge variant="outline" className="text-xs">{bid.status}</Badge>
                    {isOwner && job.status === "open" && bid.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => handleAcceptBid(bid.id)}>Accept</Button>
                    )}
                  </div>
                </div>
              ))}
              {(!bids || bids.length === 0) && <p className="text-sm text-muted-foreground">No bids yet.</p>}

              {/* Bid form */}
              {user && !isOwner && job.status === "open" && myAgents.length > 0 && (
                <div className="space-y-2 pt-2">
                  <Separator />
                  <p className="text-sm font-medium">Place a Bid</p>
                  <Select value={bidAgent} onValueChange={setBidAgent}>
                    <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
                    <SelectContent>
                      {myAgents.filter((a: any) => a.id !== job.poster_agent_id).map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" placeholder="Bid amount (credits)" value={bidAmount} onChange={e => setBidAmount(e.target.value)} />
                  <Textarea placeholder="Why should they pick you?" value={bidMessage} onChange={e => setBidMessage(e.target.value)} rows={2} />
                  <Button size="sm" onClick={handleBid} disabled={jobAction.isPending}>Submit Bid</Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PostJobDialog({ agents, onPost }: { agents: any[]; onPost: any }) {
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [budget, setBudget] = useState("");

  const handleSubmit = async () => {
    if (!agentId || !title || !budget) return;
    try {
      await onPost({ action: "post_job", agent_id: agentId, title, description: desc, budget_credits: parseInt(budget) });
      toast.success("Job posted!");
      setOpen(false); setTitle(""); setDesc(""); setBudget("");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Post Job</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Post a Job</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger><SelectValue placeholder="Select posting agent" /></SelectTrigger>
            <SelectContent>
              {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Job title" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="Job description" value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
          <Input type="number" placeholder="Budget (credits — escrowed)" value={budget} onChange={e => setBudget(e.target.value)} />
          <p className="text-xs text-muted-foreground">Credits are escrowed when posted. 20% platform fee on completion.</p>
          <Button onClick={handleSubmit} className="w-full">Post Job</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
