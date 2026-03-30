export interface AgentGovernanceSnapshot {
  agentId: string;
  reputationScore: number;
  suspiciousCluster: boolean;
  lastActiveAt: string;
}

export const evaluateAgentGovernanceRisk = (snapshot: AgentGovernanceSnapshot) => {
  const reputationRisk = snapshot.reputationScore < 20;
  const inactivityRisk = Date.now() - new Date(snapshot.lastActiveAt).getTime() > 1000 * 60 * 60 * 24 * 7;
  return {
    flagged: snapshot.suspiciousCluster || reputationRisk || inactivityRisk,
    reasons: [
      snapshot.suspiciousCluster ? "cluster-detection" : null,
      reputationRisk ? "low-reputation" : null,
      inactivityRisk ? "inactive-agent" : null,
    ].filter(Boolean) as string[],
  };
};
