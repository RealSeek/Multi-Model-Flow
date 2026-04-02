#!/usr/bin/env node

import { createInterface } from "node:readline";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const CLAUDE_DIR = path.join(HOME, ".claude");
const MCP_PATH = path.join(HOME, ".claude.json");
const CLAUDE_MD_PATH = path.join(CLAUDE_DIR, "CLAUDE.md");

const MMF_COMMANDS = ["mmf-analyze.md", "mmf-codex.md", "mmf-gemini.md", "mmf-review.md", "mmf-workflow.md"];
const MMF_SKILLS = ["codex-task", "gemini-task", "multi-model-task"];
const MCP_SERVER_KEY = "diy-workflow";

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

// ============================================================
// JSON helpers
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

// ============================================================
// File helpers
// ============================================================

function copyDir(src: string, dest: string): number {
  if (!existsSync(src)) return 0;
  if (path.resolve(src) === path.resolve(dest)) return countFiles(src);
  mkdirSync(dest, { recursive: true });
  let count = 0;
  const entries = readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const srcPath = path.join(src, e.name);
    const destPath = path.join(dest, e.name);
    if (e.isDirectory()) {
      count += copyDir(srcPath, destPath);
    } else {
      writeFileSync(destPath, readFileSync(srcPath));
      count++;
    }
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

function getServerEntryPath(): string {
  return path.join(PKG_ROOT, "dist", "index.js").replace(/\\/g, "/");
}

// ============================================================
// Remove MMF files
// ============================================================

function removeMMFFiles(): number {
  let removed = 0;

  // Remove commands
  const cmdDir = path.join(CLAUDE_DIR, "commands");
  for (const f of MMF_COMMANDS) {
    const p = path.join(cmdDir, f);
    if (existsSync(p)) { rmSync(p); removed++; }
  }

  // Remove skills
  const skillDir = path.join(CLAUDE_DIR, "skills");
  for (const d of MMF_SKILLS) {
    const p = path.join(skillDir, d);
    if (existsSync(p)) { rmSync(p, { recursive: true }); removed++; }
  }

  // Remove MMF section from CLAUDE.md
  if (existsSync(CLAUDE_MD_PATH)) {
    const content = readFileSync(CLAUDE_MD_PATH, "utf-8");
    if (content.includes("# MMF")) {
      const cleaned = content.replace(/\n*# MMF[\s\S]*$/, "").trimEnd();
      if (cleaned) {
        writeFileSync(CLAUDE_MD_PATH, cleaned + "\n", "utf-8");
      } else {
        rmSync(CLAUDE_MD_PATH);
      }
      removed++;
    }
  }

  return removed;
}

// ============================================================
// Install MMF files
// ============================================================

function installMMFFiles(): { commands: number; skills: number } {
  const cmdSrc = path.join(PKG_ROOT, ".claude", "commands");
  const cmdDest = path.join(CLAUDE_DIR, "commands");
  const commands = copyDir(cmdSrc, cmdDest);

  const skillSrc = path.join(PKG_ROOT, ".claude", "skills");
  const skillDest = path.join(CLAUDE_DIR, "skills");
  const skills = copyDir(skillSrc, skillDest);

  // Install CLAUDE.md
  const claudeMdSrc = path.join(PKG_ROOT, "CLAUDE.md");
  if (existsSync(claudeMdSrc) && path.resolve(claudeMdSrc) !== path.resolve(CLAUDE_MD_PATH)) {
    const newContent = readFileSync(claudeMdSrc, "utf-8");
    if (existsSync(CLAUDE_MD_PATH)) {
      const existing = readFileSync(CLAUDE_MD_PATH, "utf-8");
      if (!existing.includes("# MMF")) {
        writeFileSync(CLAUDE_MD_PATH, existing + "\n\n" + newContent, "utf-8");
      } else {
        // Replace existing MMF section
        const cleaned = existing.replace(/\n*# MMF[\s\S]*$/, "").trimEnd();
        writeFileSync(CLAUDE_MD_PATH, (cleaned ? cleaned + "\n\n" : "") + newContent, "utf-8");
      }
    } else {
      mkdirSync(CLAUDE_DIR, { recursive: true });
      writeFileSync(CLAUDE_MD_PATH, newContent, "utf-8");
    }
  }

  return { commands, skills };
}

// ============================================================
// MCP config
// ============================================================

function getMcpEnv(): Record<string, string> | null {
  const config = loadJson(MCP_PATH) as { mcpServers?: Record<string, { env?: Record<string, string> }> };
  return config.mcpServers?.[MCP_SERVER_KEY]?.env ?? null;
}

function writeMcpConfig(env: Record<string, string>): void {
  const config = loadJson(MCP_PATH) as { mcpServers?: Record<string, unknown> };
  if (!config.mcpServers) config.mcpServers = {};
  config.mcpServers[MCP_SERVER_KEY] = {
    type: "stdio",
    command: "node",
    args: [getServerEntryPath()],
    env,
  };
  saveJson(MCP_PATH, config);
}

function removeMcpConfig(): boolean {
  const config = loadJson(MCP_PATH) as { mcpServers?: Record<string, unknown> };
  if (config.mcpServers?.[MCP_SERVER_KEY]) {
    delete config.mcpServers[MCP_SERVER_KEY];
    saveJson(MCP_PATH, config);
    return true;
  }
  return false;
}

// ============================================================
// API Config Prompt
// ============================================================

async function promptApiConfig(defaults?: Record<string, string>) {
  console.log("  步骤 1/2: 配置 Codex (OpenAI)");
  console.log("  ─────────────────────────────────");
  const codexKey = await askRequired("API Key");
  const codexUrl = await askOptional("接口地址", defaults?.OPENAI_BASE_URL ?? "https://api.openai.com/v1");
  const codexModel = await askWithDefault("模型名称", defaults?.OPENAI_MODEL ?? "gpt-5.4");
  console.log();

  console.log("  步骤 2/2: 配置 Gemini");
  console.log("  ─────────────────────────────────");
  const geminiKey = await askRequired("API Key");
  const geminiUrl = await askOptional(
    "接口地址",
    defaults?.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/",
  );
  const geminiModel = await askWithDefault("模型名称", defaults?.GEMINI_MODEL ?? "gemini-3.1-pro-preview");
  console.log();

  return {
    OPENAI_API_KEY: codexKey,
    OPENAI_BASE_URL: codexUrl,
    OPENAI_MODEL: codexModel,
    GEMINI_API_KEY: geminiKey,
    GEMINI_BASE_URL: geminiUrl,
    GEMINI_MODEL: geminiModel,
  };
}

// PLACEHOLDER_CLI_ACTIONS

// ============================================================
// Actions
// ============================================================

async function doInstall() {
  console.log();
  const existingEnv = getMcpEnv();

  let env: Record<string, string>;
  if (existingEnv?.OPENAI_API_KEY) {
    console.log("  检测到已有 MCP 配置：");
    console.log(`  Codex:  ${existingEnv.OPENAI_MODEL ?? "gpt-5.4"} @ ${existingEnv.OPENAI_BASE_URL ?? "默认"}`);
    console.log(`  Gemini: ${existingEnv.GEMINI_MODEL ?? "gemini-3.1-pro-preview"} @ ${existingEnv.GEMINI_BASE_URL ?? "默认"}`);
    console.log();
    const reconfig = await ask("  ? 是否重新配置 API？(y/N): ");
    env = reconfig.toLowerCase() === "y" ? await promptApiConfig(existingEnv) : existingEnv;
  } else {
    env = await promptApiConfig();
  }

  console.log("  安装中...");
  console.log("  ─────────────────────────────────");

  const { commands, skills } = installMMFFiles();
  console.log(`  ✓ 已安装 ${commands} 个命令到 ~/.claude/commands/`);
  console.log(`  ✓ 已安装 ${skills} 个技能到 ~/.claude/skills/`);

  writeMcpConfig(env);
  console.log("  ✓ 已注册 MCP 服务到 ~/.claude.json");
  console.log("  ✓ 已更新 ~/.claude/CLAUDE.md");

  printSuccess();
}

async function doUpdate() {
  console.log();
  const existingEnv = getMcpEnv();
  if (!existingEnv) {
    console.log("  未检测到已有安装，将执行全新安装。");
    return doInstall();
  }

  console.log("  更新中...");
  console.log("  ─────────────────────────────────");

  // Step 1: Remove old files
  const removed = removeMMFFiles();
  console.log(`  ✓ 已清理 ${removed} 个旧文件`);

  // Step 2: Reinstall fresh files
  const { commands, skills } = installMMFFiles();
  console.log(`  ✓ 已安装 ${commands} 个命令到 ~/.claude/commands/`);
  console.log(`  ✓ 已安装 ${skills} 个技能到 ~/.claude/skills/`);

  // Step 3: Rewrite MCP config (preserve env, update server path)
  writeMcpConfig(existingEnv);
  console.log("  ✓ 已更新 MCP 服务配置（API 配置已保留）");
  console.log("  ✓ 已更新 ~/.claude/CLAUDE.md");

  printSuccess();
}

async function doUninstall() {
  console.log();
  const confirm = await ask("  ? 确认卸载 MMFlow？(y/N): ");
  if (confirm.toLowerCase() !== "y") {
    console.log("  已取消。");
    return;
  }

  console.log();
  console.log("  卸载中...");
  console.log("  ─────────────────────────────────");

  const removed = removeMMFFiles();
  console.log(`  ✓ 已清理 ${removed} 个文件`);

  if (removeMcpConfig()) {
    console.log("  ✓ 已移除 MCP 服务配置");
  }

  console.log();
  console.log("  MMFlow 已卸载。");
  console.log();
}

function printSuccess() {
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
}

function printBanner() {
  console.log();
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║   MMFlow - 多模型协作工作流           ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log();
}

// ============================================================
// Main
// ============================================================

async function main() {
  const command = process.argv[2];

  if (command === "--help" || command === "-h") {
    console.log("用法: mmflow [install|update|uninstall]");
    console.log();
    console.log("  install    安装 MMFlow（默认）");
    console.log("  update     更新 MMFlow（保留 API 配置）");
    console.log("  uninstall  卸载 MMFlow");
    process.exit(0);
  }

  printBanner();

  // Direct subcommand
  if (command === "install") { await doInstall(); rl.close(); return; }
  if (command === "update") { await doUpdate(); rl.close(); return; }
  if (command === "uninstall") { await doUninstall(); rl.close(); return; }

  // Interactive menu
  console.log("  请选择操作：");
  console.log("  1. 安装");
  console.log("  2. 更新（保留 API 配置）");
  console.log("  3. 卸载");
  console.log();

  const choice = await ask("  ? 请输入编号 (1/2/3): ");

  switch (choice) {
    case "1": await doInstall(); break;
    case "2": await doUpdate(); break;
    case "3": await doUninstall(); break;
    default:
      console.log("  无效选项，退出。");
  }

  rl.close();
}

main().catch((err) => {
  console.error("执行失败:", err);
  rl.close();
  process.exit(1);
});
