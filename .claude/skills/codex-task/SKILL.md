---
name: codex-task
description: Delegate code analysis, review, or generation tasks to Codex (OpenAI) with context collection
user-invocable: false
allowed-tools:
  - mcp__diy-workflow__task_submit
  - mcp__diy-workflow__task_status
  - mcp__diy-workflow__task_result
  - mcp__diy-workflow__task_cancel
  - mcp__ace-tool__codebase-retrieval
---

# Codex Task Skill

## Trigger Detection

Activate when the user says:
- "use codex", "ask codex", "codex review", "codex analyze", "let codex do"
- Any request explicitly targeting backend logic, security, performance, or architecture analysis

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
- **Review**: "senior code reviewer" — bugs, security, performance, style
- **Architecture**: "senior backend architect" — scalability, patterns, trade-offs
- **General**: "senior software engineer" — analysis and code suggestions

## Delegation

All tasks use async submission:
```
mcp__diy-workflow__task_submit({ prompt, domain: "backend" })
```
Then retrieve the result (waits automatically):
```
mcp__diy-workflow__task_result({ task_id: "<task_id>" })
```
Follow-up → pass `session_id` from previous call to `task_submit`

## Result Presentation

- Attribute as "Codex analysis:"
- Preserve code blocks and diffs
- Never auto-apply — ask user confirmation first
