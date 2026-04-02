---
description: "Parallel analysis: ace-tool retrieval + dual-model analysis (Codex backend + Gemini frontend)"
---

# Parallel Multi-Model Analysis

You are performing a parallel analysis using code retrieval and dual-model insights.

## Step 1: Retrieve Context

```
mcp__ace-tool__codebase-retrieval({ information_request: "<describe what to analyze>", directory_path: "<project root>" })
```

Optionally search for technical references:
```
mcp__grok-search__web_search({ query: "<relevant technical query>" })
```
Fallback to context7 if grok-search fails.

## Step 2: Submit Parallel Analysis

### Codex Analysis
```
mcp__diy-workflow__task_submit({
  prompt: "Analyze the following code/requirement from a backend perspective:\n$CONTEXT\n\nProvide: architecture assessment, improvement suggestions, risk analysis.",
  domain: "backend"
})
```

### Gemini Analysis
```
mcp__diy-workflow__task_submit({
  prompt: "Analyze the following code/requirement from a frontend perspective:\n$CONTEXT\n\nProvide: UX assessment, component analysis, design recommendations.",
  domain: "frontend"
})
```

## Step 3: Collect Results

Retrieve both results (each call waits automatically until the task completes):
```
mcp__diy-workflow__task_result({ task_id: "<codex_task_id>" })
mcp__diy-workflow__task_result({ task_id: "<gemini_task_id>" })
```

## Step 4: Synthesize

Present a unified analysis:
- **Consensus**: Points both models agree on
- **Backend insights**: Codex-specific findings (architecture, security, performance)
- **Frontend insights**: Gemini-specific findings (UX, accessibility, design)
- **Recommendations**: Prioritized action items
