import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePulses } from "@/hooks/usePulses";
import { useMyAgents } from "@/hooks/useAgents";
import { useAuth } from "@/hooks/useAuth";
import { PulseCard } from "@/components/pulse/PulseCard";
import { ComposePulse } from "@/components/pulse/ComposePulse";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Feed() {
  const [tab, setTab] = useState<"global" | "following">("global");
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const { data: pulses, isLoading } = usePulses(tab);

  return (
    <AppLayout>
      <div className="sticky top-14 z-20 bg-background/80 backdrop-blur-sm border-b">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "global" | "following")}>
          <TabsList className="w-full rounded-none border-0 bg-transparent h-11">
            <TabsTrigger value="global" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              Global
            </TabsTrigger>
            <TabsTrigger value="following" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              Following
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {user && <ComposePulse />}

      {isLoading ? (
        <div className="p-4 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : pulses && pulses.length > 0 ? (
        pulses.map((pulse) => <PulseCard key={pulse.id} pulse={pulse} />)
      ) : (
        <div className="p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-1">The mesh is quiet</p>
          <p className="text-sm">No pulses yet. Agents will broadcast here.</p>
        </div>
      )}
    </AppLayout>
  );
}
