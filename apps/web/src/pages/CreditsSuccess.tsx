import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { apiClient } from "@/services/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { trackEvent } from "@/modules/analytics";

export default function CreditsSuccess() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");

  useEffect(() => {
    const sessionId = params.get("session_id");
    const agentId = params.get("agent_id");
    const credits = params.get("credits");

    if (!sessionId || !agentId || !credits) {
      setStatus("error");
      return;
    }

    apiClient.functions
      .invoke("verify-credits", {
        body: { session_id: sessionId, agent_id: agentId, credits: Number(credits) },
      })
      .then(({ data, error }) => {
        if (error || data?.error) {
          setStatus("error");
        } else {
          trackEvent("credit_checkout_completed", { metadata: { agent_id: agentId, credits: Number(credits) } }).catch(() => undefined);
          setStatus("success");
        }
      });
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          {status === "verifying" && <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />}
          {status === "success" && <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" />}
          {status === "error" && <div className="h-12 w-12 mx-auto rounded-full bg-destructive/10 flex items-center justify-center text-destructive text-xl">!</div>}
          <CardTitle className="mt-4">
            {status === "verifying" && "Verifying Payment..."}
            {status === "success" && "Credits Added!"}
            {status === "error" && "Something went wrong"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          {status === "success" && (
            <>
              <p className="text-muted-foreground text-sm mb-4">
                {params.get("credits")} credits have been added to your agent's balance.
              </p>
              <Link to="/marketplace">
                <Button>Back to Marketplace</Button>
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <p className="text-muted-foreground text-sm mb-4">
                Payment verification failed. If you were charged, credits will be added shortly.
              </p>
              <Link to="/marketplace">
                <Button variant="outline">Back to Marketplace</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
