// agentPlannerService.js
// LLM planner for agent action planning (Groq provider, easily swappable)

import { pool } from '../db/pool.js';
import { validatePlannerOutput } from '../lib/validatePlannerOutput.js';
import { executeAgentActions } from './agentActionExecutorService.js';
import { v4 as uuidv4 } from 'uuid';
import { getLLMProvider, getLLMApiKey, getLLMModel } from '../config/llmProviderConfig.js';

/**
 * Triggers the LLM planner for an agent and executes the returned actions.
 * @param {string} agentId
 * @param {object} opts
 */
export async function triggerPlannerForAgent(agentId, opts = {}) {
  // Gather agent state/context
  const [[state]] = await pool.query('SELECT * FROM agent_state WHERE agent_id = ?', [agentId]);
  if (!state) throw new Error('Agent state not found');

  // Compose planner prompt/context
  const context = {
    agent_id: agentId,
    role: state.role,
    goals: state.goals,
    reputation: state.reputation,
    credits: state.credits,
    last_action_at: state.last_action_at,
    memory_summary: state.memory_summary,
    economic_prefs: state.economic_prefs,
    allowed_actions: state.allowed_actions,
    bootstrap: opts.bootstrap || false,
  };

  // Call LLM provider
  const provider = getLLMProvider();
  const apiKey = getLLMApiKey();
  const model = getLLMModel();
  let plannerResponse;
  if (provider === 'groq') {
    plannerResponse = await callGroqPlanner(model, apiKey, context);
  } else {
    throw new Error('Unsupported LLM provider');
  }

  // Validate planner output
  const valid = validatePlannerOutput(plannerResponse);
  if (!valid.ok) {
    await logPlannerFailure(agentId, plannerResponse, valid.error);
    throw new Error('Planner output invalid: ' + valid.error);
  }

  // Store plan
  const planId = uuidv4();
  await pool.query(
    'INSERT INTO agent_plans (id, agent_id, plan_json, run_at, status, created_at) VALUES (?, ?, ?, NOW(), ?, NOW())',
    [planId, agentId, JSON.stringify(plannerResponse), 'pending']
  );

  // Execute actions
  await executeAgentActions(agentId, plannerResponse.actions, planId);

  // Update agent_state next_action_at
  const nextRun = new Date(Date.now() + (plannerResponse.next_run_minutes || 30) * 60000);
  await pool.query('UPDATE agent_state SET last_action_at = NOW(), next_action_at = ? WHERE agent_id = ?', [nextRun, agentId]);
}

async function callGroqPlanner(model, apiKey, context) {
  // Real HTTP call to Groq API (replace with your endpoint)
  const fetch = (await import('node-fetch')).default;
  const resp = await fetch('https://api.groq.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are an agent planner for Synth-World. Output only valid JSON for agent actions.' },
        { role: 'user', content: JSON.stringify(context) },
      ],
      max_tokens: 512,
      temperature: 0.7,
    }),
  });
  if (!resp.ok) throw new Error('Groq planner API error');
  const data = await resp.json();
  // Parse JSON from LLM output
  let json;
  try {
    json = JSON.parse(data.choices[0].message.content);
  } catch (e) {
    throw new Error('Planner did not return valid JSON');
  }
  return json;
}

async function logPlannerFailure(agentId, plannerResponse, error) {
  await pool.query(
    'INSERT INTO agent_plans (id, agent_id, plan_json, run_at, status, error, created_at) VALUES (?, ?, ?, NOW(), ?, ?, NOW())',
    [uuidv4(), agentId, JSON.stringify(plannerResponse), 'failed', error]
  );
}
