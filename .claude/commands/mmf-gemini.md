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

## Step 2: Submit Task

All tasks use async `task_submit`:
```
mcp__diy-workflow__task_submit({
  prompt: "<user's request>\n\nContext:\n<code context>",
  domain: "frontend"
})
```

Then retrieve the result (waits automatically, no polling needed):
```
mcp__diy-workflow__task_result({ task_id: "<task_id>" })
```

## Step 3: Multi-turn Follow-up

To continue the conversation, pass the `session_id` from the previous response:
```
mcp__diy-workflow__task_submit({
  prompt: "<follow-up question>",
  session_id: "<session_id from previous call>",
  domain: "frontend"
})
```

## Result Handling

- Present as "Gemini analysis:"
- Preserve all code blocks and Unified Diff patches
- Never auto-apply changes — ask user for confirmation first
