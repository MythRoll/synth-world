import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface CreateListingDialogProps {
  agents: Array<{ id: string; name: string; framework: string }>;
  selectedAgent: string;
}

export function CreateListingDialog({ agents, selectedAgent }: CreateListingDialogProps) {
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState(selectedAgent);
  const [skillName, setSkillName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [listingType, setListingType] = useState("skill");
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const qc = useQueryClient();

  const createListing = useMutation({
    mutationFn: async () => {
      const priceNum = parseInt(price);
      if (!agentId) throw new Error("Select an agent");
      if (!skillName.trim()) throw new Error("Name is required");
      if (!priceNum || priceNum < 1) throw new Error("Price must be at least 1 credit");

      const { data: listing, error } = await supabase.from("skill_listings").insert({
        agent_id: agentId,
        skill_name: skillName.trim(),
        description: description.trim() || null,
        price_cents: priceNum,
        listing_type: listingType,
      }).select("id").single();
      if (error) throw error;

      // Store delivery info in separate secure table
      const dUrl = deliveryUrl.trim();
      const dInstructions = deliveryInstructions.trim();
      if (dUrl || dInstructions) {
        const { error: delErr } = await supabase.from("listing_delivery").insert({
          listing_id: listing.id,
          delivery_url: dUrl || null,
          delivery_instructions: dInstructions || null,
        });
        if (delErr) throw delErr;
      }
    },
    onSuccess: () => {
      toast.success("Listing created!");
      qc.invalidateQueries({ queryKey: ["marketplace-listings"] });
      setOpen(false);
      setSkillName("");
      setDescription("");
      setPrice("");
      setDeliveryUrl("");
      setDeliveryInstructions("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="text-xs gap-1 shrink-0">
          <Plus className="h-3.5 w-3.5" /> List Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Listing</DialogTitle>
          <DialogDescription>List a skill or digital good for sale on the marketplace.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Selling Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={listingType} onValueChange={setListingType}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skill">Skill / Service</SelectItem>
                <SelectItem value="dataset">Dataset</SelectItem>
                <SelectItem value="model">Model / Weights</SelectItem>
                <SelectItem value="tool">Tool / Plugin</SelectItem>
                <SelectItem value="other">Other Digital Good</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={skillName} onChange={(e) => setSkillName(e.target.value)} placeholder="e.g. Web Scraping API" className="h-9 text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this do?" className="text-xs min-h-[60px]" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Price (credits)</Label>
            <Input type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 50" className="h-9 text-xs" />
            {price && parseInt(price) > 0 && (
              <p className="text-[10px] text-muted-foreground">
                You receive {Math.floor(parseInt(price) * 0.8)} credits • Platform fee {Math.ceil(parseInt(price) * 0.2)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Delivery URL (optional)</Label>
            <Input value={deliveryUrl} onChange={(e) => setDeliveryUrl(e.target.value)} placeholder="https://..." className="h-9 text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Delivery Instructions (optional)</Label>
            <Textarea value={deliveryInstructions} onChange={(e) => setDeliveryInstructions(e.target.value)} placeholder="How the buyer accesses this..." className="text-xs min-h-[50px]" />
          </div>

          <Button onClick={() => createListing.mutate()} disabled={createListing.isPending} className="w-full text-xs">
            {createListing.isPending ? "Creating..." : "Create Listing"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
