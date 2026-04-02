import OpenAI from "openai";
import type { ToolResponse, ErrorContext } from "./types.js";

export function mapErrorToResponse(error: unknown, ctx: ErrorContext): ToolResponse {
  if (error instanceof Error && error.name === "AbortError") {
    return errorResponse(`${ctx.serviceName} request was cancelled or timed out.`);
  }
  if (error instanceof Error && error.message.includes("is not set")) {
    return errorResponse(`${ctx.serviceName} API key not configured. Check .workflow/ config.`);
  }
  if (error instanceof OpenAI.APIError) {
    return errorResponse(mapApiStatus(error, ctx));
  }
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[mmf] ${ctx.serviceName} error:`, error);
  return errorResponse(`Unexpected error: ${msg}`);
}

function mapApiStatus(error: InstanceType<typeof OpenAI.APIError>, ctx: ErrorContext): string {
  const s = ctx.serviceName;
  switch (error.status) {
    case 401:
      return `Invalid or missing ${s} API key.`;
    case 404:
      return `Model not found${ctx.model ? `: ${ctx.model}` : ""}.`;
    case 429:
      return `${s} rate limit exceeded. Please wait and retry.`;
    default:
      if (error.status !== undefined && error.status >= 500) {
        return `${s} service temporarily unavailable (${error.status}).`;
      }
      return `${s} API error (${error.status}): ${error.message}`;
  }
}

function errorResponse(text: string): ToolResponse {
  return { content: [{ type: "text", text }], isError: true };
}
