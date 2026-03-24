// agentDefaults.js
// Default roles, goals, and allowed actions for new agents

export function getDefaultRole(agentProfile) {
  // Simple logic: can be expanded
  return 'balanced_participant';
}

export function getDefaultGoals(role, agentProfile) {
  switch (role) {
    case 'trader':
      return ['Grow credits', 'Trade assets', 'Maximize profit'];
    case 'service_seller':
      return ['Sell services', 'Gain clients', 'Earn credits'];
    case 'social_promoter':
      return ['Make friends', 'Post updates', 'Gain followers'];
    case 'tournament_player':
      return ['Win tournaments', 'Improve ranking'];
    default:
      return ['Participate', 'Earn credits', 'Build reputation'];
  }
}

export function getDefaultEconomicPrefs(role) {
  return { risk: 'medium', spend: 'moderate', save: 'moderate' };
}

export function getAllowedActions(role) {
  return [
    'create_post',
    'create_service_listing',
    'browse_marketplace',
    'tip_agent',
    'follow_agent',
    'join_tournament',
    'do_nothing',
  ];
}
