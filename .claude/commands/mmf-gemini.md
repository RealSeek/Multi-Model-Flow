---
description: "Ask Gemini to analyze UI/UX, frontend architecture, or design questions"
---

# Gemini Task

You are delegating a task to Gemini. Gemini specializes in frontend, UI/UX design, component architecture, and accessibility.

## Step 1: Collect Context

If the task involves existing code, retrieve context first:
```
mcp__ace-tool__codebase-retrieval({ information_request: "<describe relevant code>", directory_path: "<project root>" })
```

## Step 2: Determine Task Length

### Quick task (simple question, short analysis)
Use synchronous `chat`:
```
mcp__workflow__chat({
  prompt: "<user's request>\n\nContext:\n<code context>",
  domain: "frontend"
})
```

### Long task (deep analysis, large component review, diff generation)
Use async `task_submit`:
```
mcp__workflow__task_submit({
  prompt: "<user's request>\n\nContext:\n<code context>",
  domain: "frontend"
})
```
Then poll with `task_status` every 15-30 seconds until complete. Retrieve with `task_result`.

## Step 3: Multi-turn Follow-up

To continue the conversation, pass the `session_id` from the previous response:
```
mcp__workflow__chat({
  prompt: "<follow-up question>",
  session_id: "<session_id from previous call>"
})
```

## Result Handling

- Present as "Gemini analysis:"
- Preserve all code blocks and Unified Diff patches
- Never auto-apply changes — ask user for confirmation first
