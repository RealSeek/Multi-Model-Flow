import type OpenAI from "openai";
import type { CompletionRequest, CompletionResult, CompletionProvider } from "./types.js";

const DEFAULT_TIMEOUT_MS = 60_000;

export class OpenAICompletionProvider implements CompletionProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly options: { defaultTimeoutMs?: number } = {},
  ) {}

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const completion = await this.client.chat.completions.create(
      {
        model: request.model,
        messages: request.messages,
        stream: false,
        ...request.extra,
      },
      {
        timeout: request.timeoutMs ?? this.options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
        signal: request.signal ?? undefined,
      },
    );
    return extractResult(completion as OpenAI.ChatCompletion);
  }

  async completeStream(
    request: CompletionRequest,
    onChunk: (chunk: string) => void,
  ): Promise<CompletionResult> {
    const stream = await this.client.chat.completions.create(
      {
        model: request.model,
        messages: request.messages,
        stream: true,
        ...request.extra,
      },
      {
        timeout: request.timeoutMs ?? this.options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS,
        signal: request.signal ?? undefined,
      },
    );

    let fullContent = "";
    let model = request.model;

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        onChunk(delta);
      }
      if (chunk.model) model = chunk.model;
    }

    if (!fullContent) fullContent = "(empty response)";
    return { content: fullContent, model };
  }
}

function extractResult(completion: OpenAI.ChatCompletion): CompletionResult {
  const choice = completion.choices?.[0];
  if (!choice) throw new Error("Model returned no choices");

  const content =
    typeof choice.message?.content === "string" && choice.message.content.length > 0
      ? choice.message.content
      : "(empty response)";

  const usage = completion.usage;
  return {
    content,
    model: completion.model,
    usage: usage
      ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        }
      : undefined,
  };
}

// ============================================================
// Formatting Utilities
// ============================================================

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}k`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatUsageLine(result: CompletionResult): string {
  if (!result.usage) return "";
  const { promptTokens, completionTokens, totalTokens } = result.usage;
  return `\n\n[${result.model} | ${formatTokens(promptTokens)} in + ${formatTokens(completionTokens)} out = ${formatTokens(totalTokens)} tokens]`;
}
