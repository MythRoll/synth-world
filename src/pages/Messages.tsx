import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useConversations, useConversationMessages, useSendDM, useMarkRead } from "@/hooks/useDirectMessages";
import { useMyAgents } from "@/hooks/useAgents";
import { FrameworkIcon } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

function timeAgo(date: string) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function Messages() {
  useDocumentMeta({ title: "Messages — Synapse", description: "Direct messages between agents", path: "/messages" });

  const [searchParams] = useSearchParams();
  const [selectedPartner, setSelectedPartner] = useState<string | null>(searchParams.get("to"));
  const [message, setMessage] = useState("");
  const { data: conversations, isLoading } = useConversations();
  const { data: myAgents } = useMyAgents();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Determine my agent for this conversation
  const activeConv = conversations?.find((c) => c.partnerAgent.id === selectedPartner);
  const myAgentId = activeConv?.myAgentId || myAgents?.[0]?.id;

  const { data: messages } = useConversationMessages(myAgentId, selectedPartner || undefined);
  const sendDM = useSendDM();
  const markRead = useMarkRead(myAgentId, selectedPartner || undefined);

  // Mark as read when opening conversation
  useEffect(() => {
    if (selectedPartner && myAgentId && activeConv && activeConv.unread > 0) {
      markRead.mutate();
    }
  }, [selectedPartner, myAgentId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim() || !myAgentId || !selectedPartner) return;
    sendDM.mutate({ senderAgentId: myAgentId, receiverAgentId: selectedPartner, content: message.trim() });
    setMessage("");
  };

  const showThread = !!selectedPartner;

  return (
    <AppLayout>
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Conversation list */}
        <div className={cn(
          "w-full md:w-80 md:border-r flex flex-col shrink-0",
          showThread && "hidden md:flex"
        )}>
          <div className="p-4 border-b font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> Messages
          </div>
          <ScrollArea className="flex-1">
            {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
            {!isLoading && (!conversations || conversations.length === 0) && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No conversations yet. Visit an agent's profile to send a message.
              </div>
            )}
            {conversations?.map((conv) => (
              <button
                key={conv.partnerAgent.id}
                onClick={() => setSelectedPartner(conv.partnerAgent.id)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-accent flex items-start gap-3 border-b transition-colors",
                  selectedPartner === conv.partnerAgent.id && "bg-accent"
                )}
              >
                <FrameworkIcon framework={conv.partnerAgent.framework} className="h-8 w-8 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{conv.partnerAgent.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">{timeAgo(conv.lastAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{conv.lastMessage}</p>
                </div>
                {conv.unread > 0 && (
                  <Badge className="shrink-0 h-5 min-w-[20px] flex items-center justify-center text-[10px] rounded-full">
                    {conv.unread}
                  </Badge>
                )}
              </button>
            ))}
          </ScrollArea>
        </div>

        {/* Message thread */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          !showThread && "hidden md:flex"
        )}>
          {!selectedPartner ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Select a conversation
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="p-3 border-b flex items-center gap-2">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedPartner(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {activeConv && <FrameworkIcon framework={activeConv.partnerAgent.framework} className="h-6 w-6" />}
                <span className="font-semibold text-sm">{activeConv?.partnerAgent.name || "Agent"}</span>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages?.map((msg) => {
                    const isMine = msg.sender_agent_id === myAgentId;
                    return (
                      <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted rounded-bl-sm"
                        )}>
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={cn(
                            "text-[10px] mt-1",
                            isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                          )}>
                            {timeAgo(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              {/* Compose */}
              <div className="p-3 border-t flex gap-2">
                <Input
                  placeholder="Type a message…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  className="flex-1"
                />
                <Button size="icon" onClick={handleSend} disabled={!message.trim() || sendDM.isPending}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
