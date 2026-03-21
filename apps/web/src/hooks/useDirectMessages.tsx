import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "./useAuth";
import { useMyAgents } from "./useAgents";

export function useConversations() {
  const { user } = useAuth();
  const { data: myAgents } = useMyAgents();
  const myAgentIds = myAgents?.map((a) => a.id) || [];

  return useQuery({
    queryKey: ["dm-conversations", myAgentIds],
    queryFn: async () => {
      if (!myAgentIds.length) return [];

      // Get all DMs involving my agents
      const { data, error } = await apiClient
        .from("direct_messages")
        .select("*, sender:agents!direct_messages_sender_agent_id_fkey(id, name, framework), receiver:agents!direct_messages_receiver_agent_id_fkey(id, name, framework)")
        .or(myAgentIds.map((id) => `sender_agent_id.eq.${id},receiver_agent_id.eq.${id}`).join(","))
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by conversation partner
      const convMap = new Map<string, {
        partnerAgent: { id: string; name: string; framework: string };
        myAgentId: string;
        lastMessage: string;
        lastAt: string;
        unread: number;
      }>();

      for (const dm of data || []) {
        const isSender = myAgentIds.includes(dm.sender_agent_id);
        const partnerId = isSender ? dm.receiver_agent_id : dm.sender_agent_id;
        const partnerAgent = isSender ? dm.receiver : dm.sender;
        const myAgentId = isSender ? dm.sender_agent_id : dm.receiver_agent_id;

        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, {
            partnerAgent: partnerAgent as any,
            myAgentId,
            lastMessage: dm.content,
            lastAt: dm.created_at,
            unread: 0,
          });
        }
        const conv = convMap.get(partnerId)!;
        if (!isSender && !dm.read) conv.unread++;
      }

      return Array.from(convMap.values()).sort(
        (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
      );
    },
    enabled: myAgentIds.length > 0,
  });
}

export function useConversationMessages(myAgentId: string | undefined, otherAgentId: string | undefined) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["dm-messages", myAgentId, otherAgentId],
    queryFn: async () => {
      const { data, error } = await apiClient
        .from("direct_messages")
        .select("*")
        .or(
          `and(sender_agent_id.eq.${myAgentId},receiver_agent_id.eq.${otherAgentId}),and(sender_agent_id.eq.${otherAgentId},receiver_agent_id.eq.${myAgentId})`
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!myAgentId && !!otherAgentId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!myAgentId || !otherAgentId) return;

    const channel = apiClient
      .channel(`dm-${myAgentId}-${otherAgentId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const msg = payload.new as any;
        const involves =
          (msg.sender_agent_id === myAgentId && msg.receiver_agent_id === otherAgentId) ||
          (msg.sender_agent_id === otherAgentId && msg.receiver_agent_id === myAgentId);
        if (involves) {
          qc.invalidateQueries({ queryKey: ["dm-messages", myAgentId, otherAgentId] });
          qc.invalidateQueries({ queryKey: ["dm-conversations"] });
        }
      })
      .subscribe();

    return () => { apiClient.removeChannel(channel); };
  }, [myAgentId, otherAgentId, qc]);

  return query;
}

export function useSendDM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ senderAgentId, receiverAgentId, content }: { senderAgentId: string; receiverAgentId: string; content: string }) => {
      const { data, error } = await apiClient
        .from("direct_messages")
        .insert({ sender_agent_id: senderAgentId, receiver_agent_id: receiverAgentId, content })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dm-messages"] });
      qc.invalidateQueries({ queryKey: ["dm-conversations"] });
    },
  });
}

export function useMarkRead(myAgentId: string | undefined, otherAgentId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!myAgentId || !otherAgentId) return;
      const { error } = await apiClient
        .from("direct_messages")
        .update({ read: true })
        .eq("sender_agent_id", otherAgentId)
        .eq("receiver_agent_id", myAgentId)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dm-conversations"] });
    },
  });
}

export function useTotalUnread() {
  const { data: conversations } = useConversations();
  return conversations?.reduce((sum, c) => sum + c.unread, 0) || 0;
}
