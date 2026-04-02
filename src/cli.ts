#!/usr/bin/env node

import { createInterface } from "node:readline";
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");

// ============================================================
// Readline helpers
// ============================================================

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (answer) => resolve(answer.trim())));
}

async function askWithDefault(label: string, defaultVal: string): Promise<string> {
  const answer = await ask(`  ? ${label} (默认: ${defaultVal}): `);
  return answer || defaultVal;
}

async function askRequired(label: string): Promise<string> {
  let answer = "";
  while (!answer) {
    answer = await ask(`  ? ${label}: `);
    if (!answer) console.log("    ⚠ 此项为必填");
  }
  return answer;
}

async function askOptional(label: string, defaultVal: string): Promise<string> {
  const hint = defaultVal ? `回车使用默认: ${defaultVal}` : "回车跳过";
  const answer = await ask(`  ? ${label} (${hint}): `);
  return answer || defaultVal;
}

// PLACEHOLDER_FOR_APPEND_1

// ============================================================
// File installation helpers
// ============================================================

function copyDir(src: string, dest: string): number {
  if (!existsSync(src)) return 0;
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
  // Count files copied
  let count = 0;
  const entries = readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    count += e.isDirectory() ? countFiles(path.join(src, e.name)) : 1;
  }
  return count;
}

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    count += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
  }
  return count;
}

// ============================================================
// MCP config helpers
// ============================================================

function loadJson(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

function saveJson(filePath: string, data: unknown): void {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function getServerEntryPath(): string {
  return path.join(PKG_ROOT, "dist", "index.js").replace(/\\/g, "/");
}

// PLACEHOLDER_FOR_APPEND_2

// ============================================================
// Main
// ============================================================

async function main() {
  const command = process.argv[2];

  if (command !== "init") {
    console.log("用法: mmflow init");
    console.log("  在当前项目中初始化多模型协作工作流");
    process.exit(0);
  }

  console.log();
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║   MMFlow - 多模型协作工作流           ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log();

  // ── Step 1: Codex ──────────────────────────────────────
  console.log("  步骤 1/3: 配置 Codex (OpenAI)");
  console.log("  ─────────────────────────────────");
  const codexKey = await askRequired("API Key");
  const codexUrl = await askOptional("接口地址", "https://api.openai.com/v1");
  const codexModel = await askWithDefault("模型名称", "gpt-5.4");
  console.log();

  // ── Step 2: Gemini ─────────────────────────────────────
  console.log("  步骤 2/3: 配置 Gemini");
  console.log("  ─────────────────────────────────");
  const geminiKey = await askRequired("API Key");
  const geminiUrl = await askOptional(
    "接口地址",
    "https://generativelanguage.googleapis.com/v1beta/openai/",
  );
  const geminiModel = await askWithDefault("模型名称", "gemini-3.1-pro-preview");
  console.log();

  // ── Step 3: Install ────────────────────────────────────
  console.log("  步骤 3/3: 安装中...");
  console.log("  ─────────────────────────────────");

  const projectRoot = process.cwd();
  const claudeDir = path.join(projectRoot, ".claude");

  // Copy commands
  const cmdSrc = path.join(PKG_ROOT, ".claude", "commands");
  const cmdDest = path.join(claudeDir, "commands");
  const cmdCount = copyDir(cmdSrc, cmdDest);
  console.log(`  ✓ 已安装 ${cmdCount} 个命令到 .claude/commands/`);

  // Copy skills
  const skillSrc = path.join(PKG_ROOT, ".claude", "skills");
  const skillDest = path.join(claudeDir, "skills");
  const skillCount = copyDir(skillSrc, skillDest);
  console.log(`  ✓ 已安装 ${skillCount} 个技能到 .claude/skills/`);

  // Register MCP server in .mcp.json
  const mcpPath = path.join(projectRoot, ".mcp.json");
  const mcpConfig = loadJson(mcpPath) as { mcpServers?: Record<string, unknown> };
  if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
  mcpConfig.mcpServers["diy-workflow"] = {
    type: "stdio",
    command: "node",
    args: [getServerEntryPath()],
    env: {
      OPENAI_API_KEY: codexKey,
      OPENAI_BASE_URL: codexUrl,
      OPENAI_MODEL: codexModel,
      GEMINI_API_KEY: geminiKey,
      GEMINI_BASE_URL: geminiUrl,
      GEMINI_MODEL: geminiModel,
    },
  };
  saveJson(mcpPath, mcpConfig);
  console.log("  ✓ 已注册 MCP 服务到 .mcp.json");

  // Copy CLAUDE.md
  const claudeMdSrc = path.join(PKG_ROOT, "CLAUDE.md");
  const claudeMdDest = path.join(claudeDir, "CLAUDE.md");
  if (existsSync(claudeMdSrc)) {
    // Append to existing or create new
    if (existsSync(claudeMdDest)) {
      const existing = readFileSync(claudeMdDest, "utf-8");
      if (!existing.includes("Workflow MCP")) {
        const content = readFileSync(claudeMdSrc, "utf-8");
        writeFileSync(claudeMdDest, existing + "\n\n" + content, "utf-8");
        console.log("  ✓ 已追加工作流配置到 .claude/CLAUDE.md");
      } else {
        console.log("  - .claude/CLAUDE.md 已包含工作流配置，跳过");
      }
    } else {
      mkdirSync(claudeDir, { recursive: true });
      cpSync(claudeMdSrc, claudeMdDest);
      console.log("  ✓ 已创建 .claude/CLAUDE.md");
    }
  }

  console.log();
  console.log("  完成！重启 Claude Code 即可使用。");
  console.log();
  console.log("  可用命令:");
  console.log("    /mmf-workflow  — 完整多模型开发流程");
  console.log("    /mmf-codex    — 单独调 Codex");
  console.log("    /mmf-gemini   — 单独调 Gemini");
  console.log("    /mmf-review   — 双模型代码审查");
  console.log("    /mmf-analyze  — 并行分析");
  console.log();

  rl.close();
}

main().catch((err) => {
  console.error("安装失败:", err);
  rl.close();
  process.exit(1);
});
