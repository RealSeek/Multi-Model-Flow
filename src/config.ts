import type { ModelRoute, TaskDomain, RouteDecision } from "./types.js";

// ============================================================
// Model Route Table
// ============================================================

export const MODEL_ROUTES: ModelRoute[] = [
  {
    prefix: "gemini",
    provider: "Gemini",
    configFile: "gemini.json",
    apiKeyEnv: "GEMINI_API_KEY",
    baseUrlEnv: "GEMINI_BASE_URL",
    modelEnv: "GEMINI_MODEL",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultModel: "gemini-3.1-pro-preview",
    defaultTimeout: 120_000,
  },
  // Default fallback — OpenAI/Codex (must be last)
  {
    prefix: "",
    provider: "Codex",
    configFile: "codex.json",
    apiKeyEnv: "OPENAI_API_KEY",
    baseUrlEnv: "OPENAI_BASE_URL",
    modelEnv: "OPENAI_MODEL",
    defaultModel: "gpt-5.4",
    defaultTimeout: 60_000,
  },
];

export function resolveModelRoute(model: string): ModelRoute {
  for (const route of MODEL_ROUTES) {
    if (route.prefix && model.startsWith(route.prefix)) return route;
  }
  return MODEL_ROUTES[MODEL_ROUTES.length - 1];
}

// ============================================================
// Smart Routing (domain → model + system prompt)
// ============================================================

/** Get the effective default model for a route (env > hardcoded default) */
function getDefaultModel(route: ModelRoute): string {
  return process.env[route.modelEnv] || route.defaultModel;
}

const DOMAIN_PROMPTS: Record<TaskDomain, string> = {
  frontend:
    "You are a senior frontend architect. Focus on UI/UX, component architecture, accessibility, responsive design, and performance. " +
    "You have ZERO file write permission — return analysis and Unified Diff patches only. NEVER execute actual modifications.",
  backend:
    "You are a senior backend architect. Focus on API design, database architecture, security, scalability, and reliability. " +
    "You have ZERO file write permission — return analysis and Unified Diff patches only. NEVER execute actual modifications.",
  review:
    "You are a senior code reviewer. Review code for bugs, security vulnerabilities, performance issues, and maintainability. " +
    "Rate findings as Critical/Major/Minor/Suggestion with specific line numbers. You have ZERO file write permission.",
  general:
    "You are a senior software engineer. Analyze context and complete the requested task with specific references. " +
    "If suggesting code changes, return Unified Diff patches. You have ZERO file write permission.",
};

const DOMAIN_PROVIDER: Record<TaskDomain, string> = {
  frontend: "gemini",
  backend: "",
  review: "",
  general: "",
};

export function routeByDomain(domain: TaskDomain): RouteDecision {
  const prefix = DOMAIN_PROVIDER[domain];
  const route = MODEL_ROUTES.find((r) => r.prefix === prefix) ?? MODEL_ROUTES[MODEL_ROUTES.length - 1];
  const model = getDefaultModel(route);
  return { model, provider: route.provider, systemPrompt: DOMAIN_PROMPTS[domain] };
}
