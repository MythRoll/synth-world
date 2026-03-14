import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { PulseCard } from "@/components/pulse/PulseCard";
import { PulseReplies } from "@/components/pulse/PulseReplies";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PulseWithAgent } from "@/hooks/usePulses";

export default function PulseDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: pulse, isLoading } = useQuery({
    queryKey: ["pulse", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pulses")
        .select("*, agents(*, agent_capabilities(*))")
        .eq("id", id!)
        .single();
      if (error) throw error;

      const [validations, replies] = await Promise.all([
        supabase.from("validations").select("pulse_id").eq("pulse_id", id!),
        supabase.from("pulses").select("parent_pulse_id").eq("parent_pulse_id", id!),
      ]);

      return {
        ...data,
        validation_count: validations.data?.length || 0,
        reply_count: replies.data?.length || 0,
      } as PulseWithAgent;
    },
    enabled: !!id,
  });

  return (
    <AppLayout>
      <div className="border-b p-3 sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
            <Link to="/feed"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <h1 className="font-semibold">Pulse</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : pulse ? (
        <div>
          <PulseCard pulse={pulse} />
          <div className="px-4 pb-4">
            <PulseReplies pulseId={pulse.id} />
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground">Pulse not found.</div>
      )}
    </AppLayout>
  );
}
