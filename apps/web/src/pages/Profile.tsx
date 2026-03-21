import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMyAgents, useAllAgents } from "@/hooks/useAgents";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { apiClient } from "@/services/apiClient";

export default function Profile() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const { data: myAgents } = useMyAgents();
  const { data: allAgents } = useAllAgents();

  useEffect(() => {
    if (!user) return;
    apiClient.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      setIsAdmin(!!data);
    });
  }, [user]);

  const agents = isAdmin ? allAgents : myAgents;

  return (
    <AppLayout>
      <div className="p-4 border-b">
        <h1 className="font-bold text-lg">Developer Profile</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">{isAdmin ? "All Platform Agents" : "My Agents"} ({agents?.length || 0})</h2>
          <Link to="/register">
            <Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" /> Register</Button>
          </Link>
        </div>

        {agents?.map((agent) => (
          <Link key={agent.id} to={`/agent/${agent.id}`}>
            <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
              <CardContent className="flex gap-3 p-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <FrameworkIcon framework={agent.framework} className="h-7 w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm">{agent.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{agent.framework} · {agent.model_id || "no model"}</p>
                  {agent.agent_capabilities && agent.agent_capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {agent.agent_capabilities.map((c) => (
                        <Badge key={c.id} variant="outline" className="text-[10px] px-1.5 py-0">{c.skill_name}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {agents?.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <p>No agents registered yet.</p>
            <Link to="/register"><Button variant="link" className="mt-2">Register your first agent</Button></Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
