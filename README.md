# SkillCurator

SkillCurator 是一款本地运行的 AI Agent Skills 桌面管理工具，用于统一收集、同步、整理和淘汰 Claude Code、Codex 与 OpenCode 技能。

## 功能

- **统一技能库**：读取 `~/.skills-manager/skills`，集中展示技能信息、来源、启用状态和职责分组。
- **运行面板**：汇总中央库、Preset、Agent 真实目录、项目工作区、隔离项与 Git 备份状态。
- **Preset 场景编排**：把有序 Skills 组合一次性预览、应用或移除到多个 Agent，批量结果区分成功、跳过、未变化与失败。
- **多来源导入**：支持 Git 仓库、本地目录和 `skills.sh` 引用；可扫描 Claude Code、Codex、OpenCode 的本机技能目录并收编现有技能。
- **发现热门技能**：按 GitHub Stars 展示热门 Agent Skills 仓库，并支持直接导入。
- **多工具同步**：将技能启用或撤下到 Claude Code、Codex、OpenCode；同步采用副本，中央库原文件不会被自动删除。
- **Agent 工作区**：扫描各 Agent 实际目录，区分中央已纳管和仅 Agent 存在的 Skills，并提供收编入口。
- **项目工作区**：注册本地项目，在中央库与项目的 `.claude/skills`、`.codex/skills` 目录之间添加、移除或收编技能。
- **差异与恢复**：项目状态区分内容一致、项目较新、中央较新、分叉和仅项目存在；Git 可创建只包含 `skills/` 的本地快照标签。
- **AI 辅助整理**：通过描述聚类、本机 Claude CLI 语义复核和可用调用数据生成冗余报告，辅助判断职责重叠的技能。
- **隔离与恢复**：技能可先移入隔离区并从工具目录撤下，保留恢复入口，不自动删除技能文件。
- **MCP 服务**：提供技能查询、导入、同步、报告和项目管理工具，供支持 MCP 的客户端调用。

需求文档能力映射与当前边界见 [`docs/skills-manager-integration.md`](docs/skills-manager-integration.md)。

## 适配环境

- **操作系统**：Windows 10/11 已验证；代码包含 macOS、Linux 路径适配，但尚未完成实机验证。
- **运行技术栈**：Tauri 2、React 19、TypeScript、Rust 2021、SQLite。
- **源码运行要求**：Node.js 20.19+、npm、Rust stable、Cargo，以及对应平台的 Tauri 2 系统依赖。
- **外部命令**：Git 用于仓库导入，curl 用于 GitHub 热门榜单；两者需在 `PATH` 中可用。
- **可选能力**：安装并登录 Claude Code CLI 后可启用语义冗余复核；Claude Code、Codex、OpenCode 可按实际安装情况选择同步。

```bash
npm install
npm run tauri dev
```
