import type OpenAI from "openai";

// ============================================================
// Provider Configuration
// ============================================================

export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  timeout: number;
  maxRetries: number;
}

export interface ModelRoute {
  prefix: string;
  provider: string;
  configFile: string;
  apiKeyEnv: string;
  baseUrlEnv: string;
  modelEnv: string;
  defaultBaseUrl?: string;
  defaultModel: string;
  defaultTimeout: number;
}

// ============================================================
// Completion
// ============================================================

export interface CompletionRequest {
  model: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  timeoutMs?: number;
  signal?: AbortSignal;
  extra?: Record<string, unknown>;
}

export interface CompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CompletionProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>;
  completeStream(
    request: CompletionRequest,
    onChunk: (chunk: string) => void,
  ): Promise<CompletionResult>;
}

// ============================================================
// Session (Multi-Turn)
// ============================================================

export interface SessionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Session {
  id: string;
  provider: string;
  model: string;
  messages: SessionMessage[];
  createdAt: number;
  lastUsedAt: number;
}

// ============================================================
// Async Task System
// ============================================================

export type TaskStatus = "running" | "completed" | "failed" | "cancelled";

export interface TaskState {
  taskId: string;
  status: TaskStatus;
  goal: string;
  provider: string;
  model: string;
  sessionId?: string;
  streamBuffer: string;
  progress: number;
  startedAt: number;
  completedAt?: number;
  result?: CompletionResult;
  error?: string;
  abortController?: AbortController;
}

// ============================================================
// Smart Routing
// ============================================================

export type TaskDomain = "frontend" | "backend" | "review" | "general";

export interface RouteDecision {
  model: string;
  provider: string;
  systemPrompt: string;
}

// ============================================================
// MCP Tool Response
// ============================================================

export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface ErrorContext {
  serviceName: string;
  model?: string;
}
