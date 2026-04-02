---
description: "Multi-model workflow: ace-tool retrieval + grok search + Codex/Gemini parallel analysis"
---

# Multi-Model Collaborative Workflow

You are orchestrating a multi-model collaborative workflow. Follow these phases strictly.

## Core Protocol

- **Code Sovereignty**: External models (Codex/Gemini) have ZERO file write permission. They return analysis and Unified Diff patches only. YOU (Claude) are the sole code executor.
- **Trust Rules**: Backend logic → trust Codex. Frontend/UI → trust Gemini.
- **Language**: Respond in the same language as the user's input.

## Phase 1: Research [模式：研究]

### 1.1 Code Retrieval
Use ace-tool to retrieve relevant code context:
```
mcp__ace-tool__codebase-retrieval({ information_request: "<describe what code is relevant>", directory_path: "<project root>" })
```

### 1.2 Web Search
Search for technical references using grok-search:
```
mcp__grok-search__web_search({ query: "<technical search query>" })
```

**Fallback**: If grok-search fails or is unavailable, use context7:
```
mcp__plugin_context7_context7__resolve-library-id({ libraryName: "<library>" })
mcp__plugin_context7_context7__query-docs({ context7CompatibleLibraryID: "<id>", topic: "<topic>" })
```

### 1.3 Completeness Check
Before proceeding, verify you have:
- [ ] Relevant source code context
- [ ] Technical references (if needed)
- [ ] Clear understanding of the user's requirements

## Phase 2: Parallel Analysis [模式：分析]

Submit tasks to BOTH models in parallel using `task_submit`:

### Backend Analysis (Codex)
```
mcp__diy-workflow__task_submit({
  prompt: "Analyze the following requirement and code context. Provide:\n1. Architecture analysis\n2. Implementation approach with Unified Diff patches\n3. Security considerations\n4. Performance implications\n\nRequirement: $REQUIREMENT\n\nCode Context:\n$CODE_CONTEXT\n\nTechnical References:\n$SEARCH_RESULTS",
  domain: "backend"
})
```

### Frontend Analysis (Gemini)
```
mcp__diy-workflow__task_submit({
  prompt: "Analyze the following requirement and code context. Provide:\n1. UI/UX impact analysis\n2. Component architecture with Unified Diff patches\n3. Accessibility considerations\n4. Design consistency review\n\nRequirement: $REQUIREMENT\n\nCode Context:\n$CODE_CONTEXT\n\nTechnical References:\n$SEARCH_RESULTS",
  domain: "frontend"
})
```

Record both task IDs.

## Phase 3: Collect Results [模式：收集]

Retrieve both results (each call waits automatically until the task completes, no polling needed):
```
mcp__diy-workflow__task_result({ task_id: "<codex_task_id>" })
mcp__diy-workflow__task_result({ task_id: "<gemini_task_id>" })
```

## Phase 4: Cross-Validation [模式：综合]

Compare the two analyses:
1. **Consensus** — Both agree → strong signal, adopt directly
2. **Disagreements** — Conflict → apply trust rules (backend→Codex, frontend→Gemini), explain reasoning
3. **Complementary** — Each covers different aspects → merge insights

Produce a unified implementation plan.

## Phase 5: Execution [模式：执行]

Apply the synthesized plan:
1. Apply Unified Diff patches from the trusted model
2. Refactor "dirty prototype" code to production quality
3. Ensure consistency across frontend and backend changes
4. Run any available tests

## Phase 6: Review [模式：审查]

Submit a final review task:
```
mcp__diy-workflow__task_submit({
  prompt: "Review the following code changes for bugs, security issues, and quality:\n\n$CHANGES",
  domain: "review"
})
```

Retrieve the review result:
```
mcp__diy-workflow__task_result({ task_id: "<review_task_id>" })
```

Report findings and apply fixes if needed.
