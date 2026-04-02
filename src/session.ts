import type { Session, SessionMessage } from "./types.js";

const CLEANUP_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const MAX_SESSION_MESSAGES = 50;

export class SessionStore {
  private sessions = new Map<string, Session>();

  create(provider: string, model: string, systemPrompt?: string): string {
    this.cleanup();
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const messages: SessionMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    this.sessions.set(id, {
      id,
      provider,
      model,
      messages,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    });
    return id;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  addUserMessage(id: string, content: string): SessionMessage[] | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    session.messages.push({ role: "user", content });
    session.lastUsedAt = Date.now();
    this.trimMessages(session);
    return [...session.messages];
  }

  addAssistantMessage(id: string, content: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.messages.push({ role: "assistant", content });
    session.lastUsedAt = Date.now();
  }

  list(): Array<{
    id: string;
    provider: string;
    model: string;
    messageCount: number;
    lastUsed: number;
  }> {
    return [...this.sessions.values()].map((s) => ({
      id: s.id,
      provider: s.provider,
      model: s.model,
      messageCount: s.messages.length,
      lastUsed: s.lastUsedAt,
    }));
  }

  private trimMessages(session: Session): void {
    if (session.messages.length <= MAX_SESSION_MESSAGES) return;
    const hasSystem = session.messages[0]?.role === "system";
    const system = hasSystem ? [session.messages[0]] : [];
    const keep = MAX_SESSION_MESSAGES - system.length;
    session.messages = [...system, ...session.messages.slice(-keep)];
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastUsedAt > CLEANUP_MAX_AGE_MS) {
        this.sessions.delete(id);
      }
    }
  }
}
