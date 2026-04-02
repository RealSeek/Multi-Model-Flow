---
name: multi-model-task
description: Orchestrate tasks across Codex and Gemini with context collection, search fallback, and progress polling
user-invocable: false
allowed-tools:
  - mcp__workflow__chat
  - mcp__workflow__task_submit
  - mcp__workflow__task_status
  - mcp__workflow__task_result
  - mcp__workflow__task_cancel
  - mcp__ace-tool__codebase-retrieval
  - mcp__grok-search__web_search
  - mcp__grok-search__web_fetch
  - mcp__plugin_context7_context7__resolve-library-id
  - mcp__plugin_context7_context7__query-docs
---

# Multi-Model Task Orchestration Skill

## Trigger Detection

Activate this skill when the user says:
- "use codex", "ask codex", "codex review", "codex analyze"
- "use gemini", "ask gemini", "gemini review", "gemini analyze"
- "parallel analysis", "dual review", "multi-model"
- "let codex/gemini do..."

## Context Collection Strategy

### Single-file scope
- Read the target file
- Read up to 3 local imports/dependencies
- Read corresponding test file if exists

### Multi-file scope
- List directory structure (2 levels)
- Read package.json / tsconfig.json
- Read up to 5 relevant files

### Project-wide scope
- Use `mcp__ace-tool__codebase-retrieval` for semantic search
- Read project config files
- Read key entry points

## Search Strategy

1. **Primary**: Use `mcp__grok-search__web_search` for technical references
2. **Fallback**: If grok-search returns an error or is unavailable:
   - Use `mcp__plugin_context7_context7__resolve-library-id` to find the library
   - Then `mcp__plugin_context7_context7__query-docs` to query documentation
3. **Skip**: If the task doesn't require external references, skip search entirely

## Task Delegation

### Quick tasks (< 30 seconds expected)
Use `mcp__workflow__chat` for synchronous single-turn calls:
```
mcp__workflow__chat({ prompt: "...", domain: "backend" })
```

### Long tasks (> 30 seconds expected)
Use `mcp__workflow__task_submit` + polling:
```
mcp__workflow__task_submit({ prompt: "...", domain: "backend" })
// then poll with task_status every 15-30 seconds
```

### Multi-turn conversations
Pass `session_id` to continue a conversation:
```
mcp__workflow__chat({ prompt: "follow-up question", session_id: "<previous session id>" })
```

## Polling Protocol

When a task is submitted:
1. Wait 15 seconds before first poll
2. Poll every 15-30 seconds with `task_status`
3. Report progress to user (show partial output if meaningful)
4. When status is "completed", retrieve with `task_result`
5. If status is "failed", report error and suggest retry

## Result Presentation

- Attribute results: "Codex analysis:" or "Gemini analysis:"
- Preserve all code blocks and diff patches
- Never auto-apply code changes — always ask user for confirmation
- If both models were used, present cross-validation summary

## Trust Rules

- Backend logic, security, performance → Codex is authoritative
- Frontend UI, accessibility, design → Gemini is authoritative
- When models disagree, explain both perspectives and recommend based on domain authority
