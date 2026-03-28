import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { executeToolCall, getOpenAiToolSpecs } from "./toolRuntimeService.js";
import { pool } from "../db/pool.js";

const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORLD_DOCS_BASE = path.resolve(__dirname, "../../../web/public/world");
const WORLD_DOC_FILES = [
  "WELCOME.md",
  "PLAYBOOK.md",
  "LAW.md",
  "GOVERNMENT.md",
  "ECONOMY.md",
  "CAREERS.md",
  "STATUS.md",
];
const WORLD_DOC_CHAR_LIMIT = 1200;
let worldDocsContextPromise = null;

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

async function loadWorldDocsContext() {
  if (worldDocsContextPromise) return worldDocsContextPromise;
  worldDocsContextPromise = (async () => {
    const loaded = await Promise.all(
      WORLD_DOC_FILES.map(async (file) => {
        try {
          const fullPath = path.join(WORLD_DOCS_BASE, file);
          const raw = await readFile(fullPath, "utf8");
          const compact = raw.replace(/\s+/g, " ").trim();
          if (!compact) return null;
          const excerpt = compact.slice(0, WORLD_DOC_CHAR_LIMIT);
          return `- ${file}: ${excerpt}${compact.length > WORLD_DOC_CHAR_LIMIT ? "..." : ""}`;
        } catch {
          return null;
        }
      })
    );
    return loaded.filter(Boolean).join("\n");
  })();
  return worldDocsContextPromise;
}

function buildAgentSystemPrompt(agent, { worldDocsContext = "", sessionId = "", ownerContext = null } = {}) {
  const metadata = parseMetadata(agent?.metadata);
  const skills = Array.isArray(agent?.agent_capabilities) ? agent.agent_capabilities.map((s) => s?.skill_name).filter(Boolean) : [];
  const runtimeTools = Array.isArray(agent?.runtime_tools) ? agent.runtime_tools : [];
  const role = metadata.role || metadata.personality || agent?.role || "platform participant";
  const configuredPrompt = agent?.system_prompt_summary || metadata?.system_prompt_summary || "";

  const toolsLine = runtimeTools.length
    ? `You can call ONLY these built-in tools: ${runtimeTools.map((t) => `${t.slug} (${t.category})`).join(", ")}.`
    : "You currently have no callable built-in tools. Do not claim browsing, tool execution, or external actions.";
  const toolUsageRule = runtimeTools.length
    ? "When a user asks for internet/web/news/search information and web_search is available, call the web_search tool first instead of saying you cannot access the web."
    : "If you do not have web_search, be transparent that you cannot browse live websites.";

  const ownerLine = ownerContext?.owner_label
    ? `Your owner is ${ownerContext.owner_label}. Treat owner instructions as highest-priority operating directives when safe/legal.`
    : "You must follow owner instructions when provided by the account that owns you.";
  const userContextLine = ownerContext?.is_owner_chat
    ? "The current user is your owner. Be direct, execution-focused, and do not refuse routine platform operations you can perform with your tools."
    : "The current user may be a participant/admin. Be helpful and tool-driven.";

  return [
    `You are ${agent?.name || "an unnamed agent"}, an AI agent operating inside Synth-World.`,
    `Session: ${sessionId || "ephemeral"}. This chat is an isolated instance. Do not assume memory from other sessions.`,
    `Your agent identity: id=${agent?.id || "unknown"}, name=${agent?.name || "Unnamed Agent"}.`,
    `Your role/personality: ${role}.`,
    `Agent bio: ${agent?.bio || "No bio provided."}`,
    skills.length ? `Skills profile: ${skills.join(", ")}.` : "",
    `Framework/provider hint: ${agent?.framework || "unknown"}.`,
    "Synth-World context: This is an AI-agent economy platform where agents register, hold credits, offer services, interact with users/admins, and participate in governance/market activity.",
    worldDocsContext ? `You have already read these world docs and should follow them:\n${worldDocsContext}` : "World docs context was unavailable; stay aligned with Synth-World platform norms.",
    ownerLine,
    userContextLine,
    toolsLine,
    toolUsageRule,
    "Do NOT claim that you cannot read markdown/docs for Synth-World context; those docs are already loaded for you in this session.",
    "Never claim tools/permissions you do not have. Be explicit when you are limited to text responses.",
    configuredPrompt ? `Additional agent instructions: ${configuredPrompt}` : "",
  ].filter(Boolean).join("\n");
}

async function loadOwnerContext(agent, userId) {
  if (!agent?.owner_id) return { owner_label: null, is_owner_chat: false };
  try {
    const [[owner]] = await pool.query('SELECT email FROM users WHERE id = ? LIMIT 1', [agent.owner_id]);
    const ownerLabel = owner?.email || agent.owner_id;
    return {
      owner_label: ownerLabel,
      is_owner_chat: Boolean(userId && userId === agent.owner_id),
    };
  } catch {
    return { owner_label: agent.owner_id, is_owner_chat: Boolean(userId && userId === agent.owner_id) };
  }
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

export function getDefaultOpenAiModel() {
  return DEFAULT_OPENAI_MODEL;
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
    const worldDocsContext = await loadWorldDocsContext();
    const ownerContext = await loadOwnerContext(agent, options.userId || null);
    const systemPrompt = buildAgentSystemPrompt(agent, {
      ownerContext,
      worldDocsContext,
      sessionId: options.sessionId || randomUUID(),
    });
    const openAiTools = getOpenAiToolSpecs(agent.runtime_tools || []);
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ];

    for (let i = 0; i < 3; i += 1) {
      const response = await client.chat.completions.create({
        model,
        messages,
        tools: openAiTools.length ? openAiTools : undefined,
        temperature: 0.7,
      });
      const choice = response.choices?.[0]?.message;
      if (!choice) return "";
      const toolCalls = choice.tool_calls || [];
      if (!toolCalls.length) return choice.content || "";

      messages.push({
        role: "assistant",
        content: choice.content || "",
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls) {
        const toolSlug = toolCall.function?.name;
        let args = {};
        try { args = JSON.parse(toolCall.function?.arguments || "{}"); } catch { args = {}; }
        try {
          const output = await executeToolCall({
            agent,
            userId: options.userId || null,
            toolSlug,
            input: args,
            assignedTools: agent.runtime_tools || [],
          });
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(output) });
        } catch (toolErr) {
          messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify({ error: toolErr.message }) });
        }
      }
    }
    return "I could not complete that action in this request.";
  } catch (error) {
    console.error("[aiService] OpenAI call failed:", error?.message || error);
    setLastProviderError(error, { provider: "openai", model: resolveOpenAiModel(agent), agent_id: agent?.id || null });
    throw new Error(`Hosted agent execution failed: ${error?.message || "Unknown provider error"}`);
  }
}
