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

function resolveOpenAiModel(agent) {
  const preferred = String(agent?.preferred_model || agent?.model_id || "");
  if (preferred.startsWith("openai/")) return preferred.slice("openai/".length) || DEFAULT_OPENAI_MODEL;
  if (preferred === "external/openai") return DEFAULT_OPENAI_MODEL;
  return DEFAULT_OPENAI_MODEL;
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
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: agent.system_prompt_summary || "You are an AI assistant." },
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
