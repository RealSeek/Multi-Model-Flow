import type {
  TaskState,
  CompletionResult,
  CompletionProvider,
  CompletionRequest,
} from "./types.js";
import type { SessionStore } from "./session.js";

const CLEANUP_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export class TaskStore {
  private tasks = new Map<string, TaskState>();

  create(goal: string, provider: string, model: string, sessionId?: string): TaskState {
    this.cleanup();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const task: TaskState = {
      taskId,
      status: "running",
      goal,
      provider,
      model,
      sessionId,
      streamBuffer: "",
      progress: 0,
      startedAt: Date.now(),
      abortController: new AbortController(),
    };
    this.tasks.set(taskId, task);
    return task;
  }

  get(taskId: string): TaskState | undefined {
    return this.tasks.get(taskId);
  }

  appendChunk(taskId: string, chunk: string): void {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "running") return;
    task.streamBuffer += chunk;
    task.progress = Math.min(95, Math.floor(task.streamBuffer.length / 100));
  }

  complete(taskId: string, result: CompletionResult): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = "completed";
    task.result = result;
    task.progress = 100;
    task.completedAt = Date.now();
    task.abortController = undefined;
  }

  fail(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = "failed";
    task.error = error;
    task.completedAt = Date.now();
    task.abortController = undefined;
  }

  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "running") return false;
    task.abortController?.abort();
    task.status = "cancelled";
    task.completedAt = Date.now();
    task.abortController = undefined;
    return true;
  }

  async waitForCompletion(taskId: string, timeoutMs: number): Promise<TaskState | undefined> {
    const task = this.tasks.get(taskId);
    if (!task) return undefined;
    if (task.status !== "running") return task;

    const hasTimeout = timeoutMs > 0;
    const deadline = hasTimeout ? Date.now() + timeoutMs : 0;
    while (task.status === "running" && (!hasTimeout || Date.now() < deadline)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return task;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, task] of this.tasks) {
      if (
        task.status !== "running" &&
        task.completedAt &&
        now - task.completedAt > CLEANUP_MAX_AGE_MS
      ) {
        this.tasks.delete(id);
      }
    }
  }
}

// ============================================================
// Task Execution Engine
// ============================================================

export function launchTask(
  taskStore: TaskStore,
  sessionStore: SessionStore,
  completionProvider: CompletionProvider,
  task: TaskState,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): void {
  const run = async () => {
    try {
      const request: CompletionRequest = {
        model: task.model,
        messages: messages as CompletionRequest["messages"],
        signal: task.abortController?.signal,
      };

      const result = await completionProvider.completeStream(request, (chunk) =>
        taskStore.appendChunk(task.taskId, chunk),
      );

      if (task.sessionId) {
        sessionStore.addAssistantMessage(task.sessionId, result.content);
      }

      taskStore.complete(task.taskId, result);
    } catch (error) {
      if (task.status === "cancelled") return;
      const msg = error instanceof Error ? error.message : String(error);
      taskStore.fail(task.taskId, msg);
    }
  };

  run().catch((err) => {
    console.error(`[mmf] Task ${task.taskId} error:`, err);
    taskStore.fail(task.taskId, String(err));
  });
}

// ============================================================
// Formatting
// ============================================================

export function formatTaskStatus(task: TaskState): string {
  const elapsed = Date.now() - task.startedAt;
  const elapsedStr = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;
  const lines = [
    `Task: ${task.taskId}`,
    `Status: ${task.status.toUpperCase()} | Provider: ${task.provider} | Model: ${task.model}`,
    `Elapsed: ${elapsedStr} | Progress: ~${task.progress}%`,
  ];
  if (task.streamBuffer.length > 0) {
    const preview =
      task.streamBuffer.length > 500
        ? "..." + task.streamBuffer.slice(-500)
        : task.streamBuffer;
    lines.push("", "--- Partial Output ---", preview);
  }
  if (task.error) lines.push("", `Error: ${task.error}`);
  return lines.join("\n");
}

export function formatTaskResult(task: TaskState): string {
  if (!task.result) return "No result available.";
  const elapsed = (task.completedAt ?? Date.now()) - task.startedAt;
  const elapsedStr = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;
  const lines = [
    `Task ${task.taskId} completed in ${elapsedStr}`,
    `Provider: ${task.provider} | Model: ${task.result.model}`,
  ];
  if (task.result.usage) {
    const u = task.result.usage;
    lines.push(`Tokens: ${u.promptTokens} in + ${u.completionTokens} out = ${u.totalTokens} total`);
  }
  lines.push("", "--- Result ---", task.result.content);
  return lines.join("\n");
}
