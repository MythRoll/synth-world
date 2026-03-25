import OpenAI from "openai";
import { env } from "../config/env.js";

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

let lastProviderError = null;

function setLastProviderError(error, context = {}) {
  lastProviderError = {
    message: error?.message || String(error),
    at: new Date().toISOString(),
    ...context,
  };
}

function resolveProvider(agent) {
  const preferred = String(agent?.preferred_model || agent?.model_id || "").toLowerCase();
  if (preferred.startsWith("openai/") || preferred === "external/openai") return "openai";
  const framework = String(agent?.framework || "").toLowerCase();
  if (!framework || ["openai", "custom", "langchain", "crewai", "autogpt"].includes(framework)) return "openai";
  return "openai";
}

function parseMetadata(metadata) {
  if (!metadata) return {};
  if (typeof metadata === "object") return metadata;
  if (typeof metadata === "string") {
    try { return JSON.parse(metadata); } catch { return {}; }
  }
  return {};
}

function resolveOpenAiModel(agent) {
  const metadata = parseMetadata(agent?.metadata);
  const preferred = String(agent?.preferred_model || agent?.model_id || metadata?.model_id || "");
  if (preferred.startsWith("openai/")) return preferred.slice("openai/".length) || DEFAULT_OPENAI_MODEL;
  if (preferred === "external/openai") return DEFAULT_OPENAI_MODEL;
  if (preferred) return preferred;
  return DEFAULT_OPENAI_MODEL;
}

function buildAgentSystemPrompt(agent) {
  const metadata = parseMetadata(agent?.metadata);
  const skills = Array.isArray(agent?.agent_capabilities)
    ? agent.agent_capabilities.map((s) => s?.skill_name).filter(Boolean)
    : [];
  const role = metadata.role || metadata.personality || agent?.role || "platform participant";
  const configuredPrompt = agent?.system_prompt_summary || metadata?.system_prompt_summary || "";

  const toolsLine = skills.length
    ? `You can reference only these configured skills: ${skills.join(", ")}. Do not claim extra tools.`
    : "You currently have no callable external tools. Do not claim browsing, tool execution, or external actions.";

  return [
    `You are ${agent?.name || "an unnamed agent"}, an AI agent operating inside Synth-World.`,
    `Your agent identity: id=${agent?.id || "unknown"}, name=${agent?.name || "Unnamed Agent"}.`,
    `Your role/personality: ${role}.`,
    `Agent bio: ${agent?.bio || "No bio provided."}`,
    `Framework/provider hint: ${agent?.framework || "unknown"}.`,
    "Synth-World context: This is an AI-agent economy platform where agents register, hold credits, offer services, interact with users/admins, and participate in governance/market activity.",
    toolsLine,
    "Never claim tools/permissions you do not have. Be explicit when you are limited to text responses.",
    configuredPrompt ? `Additional agent instructions: ${configuredPrompt}` : "",
  ].filter(Boolean).join("\n");
}

export function getProviderStatus() {
  return {
    provider: "openai",
    configured: Boolean(env.openaiApiKey),
    default_model: DEFAULT_OPENAI_MODEL,
    last_error: lastProviderError,
  };
}

export function getLastProviderError() {
  return lastProviderError;
}

export async function runHostedAgent(agent, message, options = {}) {
  const provider = resolveProvider(agent);
  if (provider !== "openai") {
    const err = new Error(`Unsupported hosted provider '${provider}'.`);
    setLastProviderError(err, { provider });
    throw err;
  }

  const apiKey = options.apiKey || env.openaiApiKey;
  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY is missing. Configure OPENAI_API_KEY for hosted agent execution.");
    setLastProviderError(err, { provider: "openai" });
    throw err;
  }

  try {
    const client = new OpenAI({ apiKey });
    const model = resolveOpenAiModel(agent);
    const systemPrompt = buildAgentSystemPrompt(agent);
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      temperature: 0.7,
    });

    return response.choices?.[0]?.message?.content || "";
  } catch (error) {
    console.error("[aiService] OpenAI call failed:", error?.message || error);
    setLastProviderError(error, { provider: "openai", model: resolveOpenAiModel(agent), agent_id: agent?.id || null });
    throw new Error(`Hosted agent execution failed: ${error?.message || "Unknown provider error"}`);
  }
}
