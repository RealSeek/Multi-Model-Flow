#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { resolveModelRoute, routeByDomain, MODEL_ROUTES } from "./config.js";
import { getClient } from "./client.js";
import { OpenAICompletionProvider, formatUsageLine } from "./completion.js";
import { mapErrorToResponse } from "./errors.js";
import { SessionStore } from "./session.js";
import { TaskStore, launchTask, formatTaskStatus, formatTaskResult } from "./task.js";
import type { TaskDomain, ToolResponse, SessionMessage } from "./types.js";

const sessionStore = new SessionStore();
const taskStore = new TaskStore();

const text = (s: string): ToolResponse => ({ content: [{ type: "text", text: s }] });

function getProviderForModel(model: string) {
  const route = resolveModelRoute(model);
  const client = getClient(route);
  return {
    route,
    provider: new OpenAICompletionProvider(client, { defaultTimeoutMs: route.defaultTimeout }),
  };
}

/** Resolve model + system prompt from domain or explicit model */
function resolveModelAndPrompt(args: {
  model?: string;
  domain?: string;
  system_prompt?: string;
}) {
  let model: string;
  let systemPrompt: string | undefined = args.system_prompt;
  let providerName: string;

  if (args.domain) {
    const decision = routeByDomain(args.domain as TaskDomain);
    model = args.model ?? decision.model;
    if (!systemPrompt) systemPrompt = decision.systemPrompt;
    providerName = decision.provider;
  } else {
    // No domain specified — use explicit model or default Codex model from env
    const codexRoute = MODEL_ROUTES[MODEL_ROUTES.length - 1];
    model = args.model ?? process.env[codexRoute.modelEnv] ?? codexRoute.defaultModel;
    const route = resolveModelRoute(model);
    providerName = route.provider;
  }

  return { model, systemPrompt, providerName };
}

// ============================================================
// MCP Server
// ============================================================

const server = new McpServer({ name: "mmf", version: "0.1.0" });

// ============================================================
// Tool 1: chat — synchronous single/multi-turn
// ============================================================

server.tool(
  "chat",
  "Send a prompt to Codex (OpenAI) or Gemini. Supports session reuse for multi-turn conversations. " +
    "Use `domain` for smart routing (frontend→Gemini, backend→Codex) or specify `model` directly. " +
    "External models are READ-ONLY — they return analysis/diffs only.",
  {
    prompt: z.string().min(1).describe("The prompt to send"),
    system_prompt: z.string().optional().describe("System prompt (overrides domain default)"),
    model: z.string().optional().describe("Model name (e.g. gpt-4o, gemini-2.5-pro). If omitted, uses domain routing."),
    domain: z.enum(["frontend", "backend", "review", "general"]).optional().describe("Smart routing domain"),
    session_id: z.string().optional().describe("Session ID for multi-turn conversation. Omit to start new."),
  },
  async (args) => {
    try {
      const { model, systemPrompt, providerName } = resolveModelAndPrompt(args);
      const { route, provider } = getProviderForModel(model);

      let messages: SessionMessage[];
      let sessionId = args.session_id;

      if (sessionId) {
        // Resume existing session
        const history = sessionStore.addUserMessage(sessionId, args.prompt);
        if (!history) return text(`Session not found: ${sessionId}`);
        messages = history;
      } else {
        // New session
        sessionId = sessionStore.create(providerName, model, systemPrompt);
        messages = sessionStore.addUserMessage(sessionId, args.prompt)!;
      }

      const result = await provider.complete({
        model,
        messages: messages as any,
      });

      sessionStore.addAssistantMessage(sessionId, result.content);

      const usageLine = formatUsageLine(result);
      return text(
        `[Session: ${sessionId} | Provider: ${providerName}]\n\n${result.content}${usageLine}`,
      );
    } catch (error) {
      const { providerName } = resolveModelAndPrompt(args);
      return mapErrorToResponse(error, { serviceName: providerName, model: args.model });
    }
  },
);

// ============================================================
// Tool 2: task_submit — async long-running task
// ============================================================

server.tool(
  "task_submit",
  "Submit a long-running task to Codex or Gemini. Returns immediately with a task ID. " +
    "Use task_status to poll progress (shows partial streaming output). " +
    "Use task_result to get the final result when completed.",
  {
    prompt: z.string().min(1).describe("The prompt/goal for the task"),
    system_prompt: z.string().optional().describe("System prompt (overrides domain default)"),
    model: z.string().optional().describe("Model name"),
    domain: z.enum(["frontend", "backend", "review", "general"]).optional().describe("Smart routing domain"),
    session_id: z.string().optional().describe("Session ID for multi-turn context"),
  },
  async (args) => {
    try {
      const { model, systemPrompt, providerName } = resolveModelAndPrompt(args);
      const { provider } = getProviderForModel(model);

      let messages: SessionMessage[];
      let sessionId = args.session_id;

      if (sessionId) {
        const history = sessionStore.addUserMessage(sessionId, args.prompt);
        if (!history) return text(`Session not found: ${sessionId}`);
        messages = history;
      } else {
        sessionId = sessionStore.create(providerName, model, systemPrompt);
        messages = sessionStore.addUserMessage(sessionId, args.prompt)!;
      }

      const task = taskStore.create(args.prompt, providerName, model, sessionId);
      launchTask(taskStore, sessionStore, provider, task, messages);

      return text(
        `Task submitted.\n` +
          `Task ID: ${task.taskId}\n` +
          `Session: ${sessionId}\n` +
          `Provider: ${providerName} | Model: ${model}\n\n` +
          `Poll progress with task_status. Get result with task_result when completed.`,
      );
    } catch (error) {
      const { providerName } = resolveModelAndPrompt(args);
      return mapErrorToResponse(error, { serviceName: providerName, model: args.model });
    }
  },
);

// ============================================================
// Tool 3: task_status — poll progress
// ============================================================

server.tool(
  "task_status",
  "Check the progress of a running task. Returns status, elapsed time, and partial streaming output.",
  {
    task_id: z.string().describe("The task ID returned by task_submit"),
  },
  async (args) => {
    const task = taskStore.get(args.task_id);
    if (!task) return text(`Task not found: ${args.task_id}`);
    return text(formatTaskStatus(task));
  },
);

// ============================================================
// Tool 4: task_result — get completed result
// ============================================================

server.tool(
  "task_result",
  "Get the full result of a completed task, including token usage.",
  {
    task_id: z.string().describe("The task ID returned by task_submit"),
  },
  async (args) => {
    const task = taskStore.get(args.task_id);
    if (!task) return text(`Task not found: ${args.task_id}`);
    if (task.status === "running") {
      return text(`Task is still running. Use task_status to check progress.\n\n${formatTaskStatus(task)}`);
    }
    if (task.status === "failed") {
      return text(`Task failed: ${task.error ?? "unknown error"}`);
    }
    if (task.status === "cancelled") {
      return text("Task was cancelled.");
    }
    return text(formatTaskResult(task));
  },
);

// ============================================================
// Tool 5: task_cancel — cancel running task
// ============================================================

server.tool(
  "task_cancel",
  "Cancel a running task.",
  {
    task_id: z.string().describe("The task ID to cancel"),
  },
  async (args) => {
    const cancelled = taskStore.cancel(args.task_id);
    if (cancelled) {
      return text(`Task ${args.task_id} cancelled.`);
    }
    const task = taskStore.get(args.task_id);
    if (!task) return text(`Task not found: ${args.task_id}`);
    return text(`Task is already ${task.status}, cannot cancel.`);
  },
);

// ============================================================
// Start Server
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mmf] Server started");
}

main().catch((err) => {
  console.error("[mmf] Fatal error:", err);
  process.exit(1);
});
