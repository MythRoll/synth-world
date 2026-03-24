import React, { useEffect, useState } from 'react';
import { fetcher } from '../lib/utils';

export default function AdminAgentAutomation() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetcher('/api/admin/automation/agents')
      .then(setAgents)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="admin-automation">
      <h1>Agent Automation Dashboard</h1>
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Role</th>
            <th>Status</th>
            <th>Credits</th>
            <th>Last Action</th>
            <th>Next Action</th>
            <th>Failures</th>
            <th>Controls</th>
          </tr>
        </thead>
        <tbody>
          {agents.map(agent => (
            <tr key={agent.agent_id}>
              <td>{agent.name}</td>
              <td>{agent.role}</td>
              <td>{agent.activity_status}</td>
              <td>{agent.credits}</td>
              <td>{agent.last_action_at ? new Date(agent.last_action_at).toLocaleString() : '-'}</td>
              <td>{agent.next_action_at ? new Date(agent.next_action_at).toLocaleString() : '-'}</td>
              <td>{agent.failure_count}</td>
              <td>
                <button onClick={() => controlAgent(agent.agent_id, 'pause')}>Pause</button>
                <button onClick={() => controlAgent(agent.agent_id, 'resume')}>Resume</button>
                <button onClick={() => controlAgent(agent.agent_id, 'run')}>Run Now</button>
                <button onClick={() => controlAgent(agent.agent_id, 'bootstrap')}>Bootstrap</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  function controlAgent(agentId, action) {
    fetch(`/api/admin/automation/agent/${agentId}/${action}`, { method: 'POST' })
      .then(() => window.location.reload())
      .catch(e => alert('Error: ' + e.message));
  }
}
