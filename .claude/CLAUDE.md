# MMF - Claude Code 全局提示词

## 核心约定
- 使用 mise 去调用 Java、Python 这类语言的运行时
- 运行在 Windows 系统内，运行环境是 PowerShell
- 先列好方案，向用户确认是否要修改代码，再去修改
- 思考用英文，回复用户用中文
- 使用标准 Markdown 格式；代码块用反引号包裹
- 简洁直接，不废话

## MCP 工具速查表

优先使用 MCP 工具，而非手动方式：

| 工具 | 使用时机 | 说明 |
|------|---------|------|
| `mcp__ace-tool__codebase-retrieval` | 生成任何代码之前 | 语义代码检索，用英文查询 |
| `mcp__grok-search__web_search` | 需要外部文档、最新信息 | 失败时回退到 context7 |
| `mcp__plugin_context7_context7__query-docs` | grok-search 不可用或失败时 | 库文档查询回退方案 |
| `mcp__diy-workflow__task_submit` | 所有 Codex/Gemini 任务 | 用 `domain` 参数智能路由，返回 task_id |
| `mcp__diy-workflow__task_result` | 获取任务结果 | 不要传 timeout 参数，默认无限等待直到完成，无需轮询 |

## 命令速查表

| 命令 | 使用时机 |
|------|---------|
| `/mmf-workflow` | 完整多模型开发流程（研究→分析→综合→执行→审查） |
| `/mmf-codex` | 单独调 Codex 做后端/逻辑/安全分析 |
| `/mmf-gemini` | 单独调 Gemini 做前端/UI/设计分析 |
| `/mmf-review` | 双模型并行代码审查（Codex + Gemini） |
| `/mmf-analyze` | 并行分析（代码检索 + 双模型） |

## 工作流原则

1. **先检索，后生成** — 写代码前必须调用 `codebase-retrieval` 或 `web_search`
2. **简单任务 → Claude 单独完成** — 不要在简单任务上强行多模型协作
3. **代码主权** — Codex/Gemini 只负责分析；所有代码修改由 Claude 执行
4. **并行执行** — 独立的 MCP 调用和模型查询并行运行
5. **搜索回退** — grok-search 失败 → context7；绝不跳过研究阶段

## 智能路由

- 前端 / UI / 设计 → Gemini（`domain: "frontend"`）
- 后端 / 逻辑 / 安全 → Codex（`domain: "backend"`）
- 代码审查 → Codex（`domain: "review"`）
- 通用任务 → Codex（`domain: "general"`）

## 多模型协作规范

- 外部模型拥有 **零文件写入权限** — 只返回分析结果和 Unified Diff 补丁
- 信任规则：后端逻辑 → 信任 Codex，前端 UI → 信任 Gemini
- 模型意见冲突时 → 按领域权威裁决，说明理由
- 应用建议修改前必须征求用户确认
- `task_result` 内置长轮询，调用一次即可等待结果，无需反复轮询 `task_status`

## Session 复用

- 首次调用返回 `session_id` — 后续调用传入即可续接多轮对话
- Session 闲置 1 小时后自动过期
- 适用于迭代优化场景（审查 → 修复 → 再审查）
