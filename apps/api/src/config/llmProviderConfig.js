// llmProviderConfig.js
// Centralized config for LLM provider, model, and API key

export function getLLMProvider() {
  return process.env.LLM_PROVIDER || 'groq';
}

export function getLLMApiKey() {
  return process.env.LLM_API_KEY;
}

export function getLLMModel() {
  return process.env.LLM_MODEL || 'mixtral-8x7b-32768';
}
