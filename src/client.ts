import OpenAI from "openai";
import type { ModelRoute } from "./types.js";

const clients = new Map<string, OpenAI>();

export function getClient(route: ModelRoute): OpenAI {
  const cached = clients.get(route.configFile);
  if (cached) return cached;

  const apiKey = process.env[route.apiKeyEnv] || "";
  if (!apiKey) {
    throw new Error(
      `${route.apiKeyEnv} is not set. Configure it in MCP server env.`,
    );
  }

  const baseURL = process.env[route.baseUrlEnv] || route.defaultBaseUrl || "";

  const client = new OpenAI({
    apiKey,
    ...(baseURL && { baseURL }),
    maxRetries: 3,
  });
  clients.set(route.configFile, client);
  return client;
}
