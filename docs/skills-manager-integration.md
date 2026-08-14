# Skills Manager 核心能力合并说明

本文记录外部《Skills Manager 产品需求文档（当前实现基线）》与 SkillCurator 的合并范围。目标是复用成熟的管理模型，同时保留本项目的差异化能力：AI 策展、调用数据裁决与安全隔离。

## 已合并能力

| 需求域 | SkillCurator 当前实现 |
| --- | --- |
| 中央仓库 | 继续以 `~/.skills-manager/skills` 为内容真相；SkillCurator 自身状态保存在 `~/.skill-curator/state.json`，不修改 Skills Manager SQLite |
| 仪表盘 | 汇总 Skills、Preset、Agent 目录、项目、隔离项、来源追踪与 Git 状态，并提供处理入口 |
| Preset | 支持创建、更新、删除、有序成员、默认目标 Agent、执行预览、一次性应用与移除 |
| 批量结果 | Preset 和批量分发分别返回成功、跳过、未变化、失败；存在失败时显示部分失败 |
| 标签 | Skill 详情支持最多 12 个自定义标签；来源和领域标签由系统维护 |
| 全局 Agent 工作区 | 实时扫描 Claude Code、Codex、OpenCode 目录，区分中央已纳管与仅 Agent 存在的 Skill |
| 项目差异 | 区分 `in_sync`、`project_newer`、`center_newer`、`diverged`、`project_only`，由用户选择覆盖方向 |
| Git 备份 | 读取真实 Git 状态；显式创建仅包含 `skills/` 的本地提交与时间戳快照标签 |
| 审计 | 记录 Preset、标签和 Git 快照活动，保留最近 200 条本机记录 |
| MCP | 新增 Preset 列表/保存/预览/应用、标签和 Git 状态工具，复用同一 Rust 逻辑 |

## 保留的项目特色

- 描述聚类、本机 Claude CLI 语义复核和 90 天调用数据裁决。
- 30 天安全隔离与恢复，永不自动删除中央 Skill。
- Git、本地目录、skills.sh 与本机 Agent 目录的统一收编入口。
- GitHub Stars 热门仓库发现与缓存。

## 当前边界

- 状态仍使用原子写入的 JSON，而不是外部 PRD 的 SQLite、WAL 和跨进程排他锁模型。
- 全局同步仍是复制模式；尚未提供 Symlink/Junction 选择与内容哈希跳过。
- Git 页面当前提供状态和本地快照；克隆、pull、push、远程设置与快照恢复尚未合并。
- 来源更新检查、文件级更新 Diff、压缩包导入、安装取消、自定义 Agent、托盘和应用自动更新尚未合并。
- Preset 是一次性应用。当前不记录多个 Preset 对同一 `Skill × Agent` 落点的所有权，移除共享成员前需要人工确认。
- GUI、MCP 和未来 CLI 对 `state.json` 的并发写入尚无跨进程锁；需要在扩展自动化写操作前补齐。

## 验证基线

- 前端：`npm run build`
- Rust Core 与桌面端：`cargo test --manifest-path src-tauri/Cargo.toml`
- MCP：构建 `skill-curator-mcp` 后通过 newline-delimited JSON-RPC 执行 `initialize`、`tools/list` 和至少一个只读工具。
