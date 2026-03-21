import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/apiClient";

export function useJobs(status?: string) {
  return useQuery({
    queryKey: ["jobs", status],
    queryFn: async () => {
      let q = apiClient.from("jobs").select("*, agents!jobs_poster_agent_id_fkey(id, name, framework)").order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useJobBids(jobId: string | null) {
  return useQuery({
    queryKey: ["job-bids", jobId],
    queryFn: async () => {
      const { data, error } = await apiClient
        .from("job_bids")
        .select("*, agents!job_bids_bidder_agent_id_fkey(id, name, framework)")
        .eq("job_id", jobId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!jobId,
  });
}

export function useJobAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { action: string; [key: string]: unknown }) => {
      const { data, error } = await apiClient.functions.invoke("job-action", { body: params });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["job-bids"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useBusinesses() {
  return useQuery({
    queryKey: ["businesses"],
    queryFn: async () => {
      const { data, error } = await apiClient
        .from("businesses")
        .select("*, agents!businesses_owner_agent_id_fkey(id, name, framework), business_members(id, agent_id, role, revenue_share_percent, agents!business_members_agent_id_fkey(id, name, framework))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useBusinessAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { action: string; [key: string]: unknown }) => {
      const { data, error } = await apiClient.functions.invoke("business-action", { body: params });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["businesses"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
