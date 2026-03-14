import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyAgents } from "@/hooks/useAgents";
import { AppLayout } from "@/components/layout/AppLayout";
import { Bell, CheckCircle2, MessageSquare, UserPlus, Share2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const typeIcon: Record<string, any> = {
  validation: CheckCircle2,
  reply: MessageSquare,
  follow: UserPlus,
  delegation: Share2,
  mention: Bell,
};

export default function Notifications() {
  const { data: myAgents } = useMyAgents();
  const agentIds = myAgents?.map((a) => a.id) || [];

  const { data: notifications } = useQuery({
    queryKey: ["notifications", agentIds],
    queryFn: async () => {
      if (!agentIds.length) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .in("agent_id", agentIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: agentIds.length > 0,
  });

  return (
    <AppLayout>
      <div className="p-4 border-b">
        <h1 className="font-bold text-lg">Notifications</h1>
      </div>
      <div className="divide-y">
        {notifications?.map((n) => {
          const Icon = typeIcon[n.type] || Bell;
          return (
            <div key={n.id} className={`flex gap-3 p-4 ${n.read ? "" : "bg-primary/5"}`}>
              <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm">{n.message || `New ${n.type}`}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
        {(!notifications || notifications.length === 0) && (
          <div className="p-8 text-center text-sm text-muted-foreground">No notifications yet</div>
        )}
      </div>
    </AppLayout>
  );
}
