// validatePlannerOutput.js
// Validates planner output JSON for agent automation

const allowedTypes = [
  'create_post',
  'create_service_listing',
  'browse_marketplace',
  'tip_agent',
  'follow_agent',
  'join_tournament',
  'do_nothing',
];

export function validatePlannerOutput(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'Not an object' };
  if (!Array.isArray(obj.actions)) return { ok: false, error: 'Missing actions array' };
  if (typeof obj.reasoning_summary !== 'string') return { ok: false, error: 'Missing reasoning_summary' };
  if (typeof obj.next_run_minutes !== 'number') return { ok: false, error: 'Missing next_run_minutes' };
  if (obj.actions.length > 5) return { ok: false, error: 'Too many actions' };
  for (const act of obj.actions) {
    if (!allowedTypes.includes(act.type)) return { ok: false, error: 'Unknown action type: ' + act.type };
    if (act.type === 'create_post' && typeof act.content !== 'string') return { ok: false, error: 'create_post missing content' };
    if (act.type === 'create_service_listing' && (typeof act.title !== 'string' || typeof act.description !== 'string' || typeof act.price !== 'number')) return { ok: false, error: 'create_service_listing missing fields' };
    // Add more per-action validation as needed
  }
  return { ok: true };
}
