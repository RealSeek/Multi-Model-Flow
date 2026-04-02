---
name: gemini-task
description: Delegate UI/UX analysis, frontend review, or design tasks to Gemini with context collection
user-invocable: false
allowed-tools:
  - mcp__diy-workflow__task_submit
  - mcp__diy-workflow__task_status
  - mcp__diy-workflow__task_result
  - mcp__diy-workflow__task_cancel
  - mcp__ace-tool__codebase-retrieval
---

# Gemini Task Skill

## Trigger Detection

Activate when the user says:
- "use gemini", "ask gemini", "gemini review", "gemini analyze", "let gemini do"
- Any request explicitly targeting frontend, UI/UX, accessibility, or design analysis

## Context Collection

### 1. Determine Scope
- **Single-file**: Read target file + up to 3 imports + test file
- **Multi-file**: List directory (2 levels) + read up to 5 relevant files + config files
- **Project-wide**: Use `mcp__ace-tool__codebase-retrieval` for semantic search

### 2. Assemble Prompt
Structure the prompt as:
```
Task: <user's request>

Project Context:
<CLAUDE.md summary if exists, keep under 100 lines>

Code:
<relevant file contents, truncate files >300 lines to first 50 + last 20>

Instructions:
<specific focus areas based on task type>
```

### 3. Select System Prompt by Task Type
- **Review**: "senior frontend reviewer" — UI consistency, accessibility, responsive design
- **Design**: "senior UI/UX architect" — component patterns, design systems, user experience
- **General**: "senior frontend engineer" — analysis and code suggestions

## Delegation

All tasks use async submission:
```
mcp__diy-workflow__task_submit({ prompt, domain: "frontend" })
```
Then retrieve the result (waits automatically):
```
mcp__diy-workflow__task_result({ task_id: "<task_id>" })
```
Follow-up → pass `session_id` from previous call to `task_submit`

## Result Presentation

- Attribute as "Gemini analysis:"
- Preserve code blocks and diffs
- Never auto-apply — ask user confirmation first
