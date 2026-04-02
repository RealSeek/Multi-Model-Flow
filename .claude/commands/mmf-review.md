---
description: "Dual-model code review: Codex (logic/security) + Gemini (UI/accessibility) in parallel"
---

# Dual-Model Code Review

You are performing a parallel code review using both Codex and Gemini.

## Step 1: Collect Review Context

Use ace-tool to retrieve the code to review:
```
mcp__ace-tool__codebase-retrieval({ information_request: "<describe the code to review>", directory_path: "<project root>" })
```

Also gather the git diff if applicable (use `git diff` or `git diff --staged`).

## Step 2: Submit Parallel Reviews

### Codex Review (Logic + Security + Performance)
```
mcp__workflow__task_submit({
  prompt: "Review the following code. Focus on:\n1. Logic bugs and edge cases\n2. Security vulnerabilities\n3. Performance issues\n4. Error handling gaps\n\nRate each finding: Critical / Major / Minor / Suggestion\nInclude specific line numbers.\n\nCode:\n$CODE",
  domain: "review"
})
```

### Gemini Review (UI + Accessibility + Design)
```
mcp__workflow__task_submit({
  prompt: "Review the following code. Focus on:\n1. UI/UX consistency\n2. Accessibility compliance\n3. Responsive design issues\n4. Component architecture\n\nRate each finding: Critical / Major / Minor / Suggestion\nInclude specific line numbers.\n\nCode:\n$CODE",
  domain: "frontend"
})
```

## Step 3: Poll Progress

Poll both tasks every 15-30 seconds using `task_status`. When complete, retrieve with `task_result`.

## Step 4: Synthesize Review

Merge findings from both reviewers:
- Deduplicate overlapping findings
- Backend/logic findings → trust Codex
- Frontend/UI findings → trust Gemini
- Present unified review with severity ratings

## Step 5: Apply Fixes (if requested)

If the user wants fixes applied:
1. Address Critical and Major findings first
2. Apply changes using Claude's file editing tools
3. Re-run review on changed files if needed
