# Codex 技能调用日志探查

本工单选择**路径 B**：Codex 会话 JSONL 没有专用的技能调用事件，而读取 `SKILL.md` 只是可漏报、可误报的间接痕迹，不能可靠支撑技能调用计数。

## 探查范围与隐私边界

探查日期为 2026-08-11。只枚举目录、JSON 字段名、字段类型和工具调用元数据；没有输出、复制或保存任何用户消息、助手消息、推理、工具参数原文或工具输出。

本机快照包含 607 个会话 JSONL，约 435 MB：

| 位置 | 文件数 | 结构 |
|---|---:|---|
| `~/.codex/sessions/YYYY/MM/DD/` | 492 | `rollout-<timestamp>-<id>.jsonl`，当前及历史会话 |
| `~/.codex/archived_sessions/` | 115 | `rollout-<timestamp>-<id>.jsonl`，已归档会话 |
| `~/.codex/history.jsonl` | 1 | `session_id`、`text`、`ts`；只有历史输入索引，不含工具调用 |
| `~/.codex/session_index.jsonl` | 1 | `id`、`thread_name`、`updated_at`；只有会话索引，不含工具调用 |

结构扫描覆盖约 11.98 万条会话记录。扫描时未发现 JSON 解析失败或超过 300 MB 的单个会话文件；这些数字是动态快照，会随当前会话写入而变化。

## 会话记录格式

`sessions` 与 `archived_sessions` 中的文件均为 JSON Lines：每行是一个独立 JSON 对象，顶层字段稳定为：

| 字段 | 类型 | 用途 |
|---|---|---|
| `timestamp` | string | ISO 8601 / RFC 3339 兼容时间；候选工具调用记录中均存在且可解析 |
| `type` | string | 顶层记录类别 |
| `payload` | object | 随记录类别变化的载荷 |

与本工单有关的主要记录形状如下。只列字段，不列字段值：

| 顶层 `type` | `payload.type` | 相关 payload 字段 |
|---|---|---|
| `session_meta` | 无 | `id`、`timestamp`、`cwd`、`originator`、`cli_version`、`source`、`model_provider`、`git` 等 |
| `turn_context` | 无 | `turn_id`、`cwd`、`model`、`approval_policy`、`sandbox_policy`、`user_instructions`、`developer_instructions` 等 |
| `response_item` | `function_call` | `type`、`name`、`arguments`、`call_id`、`id`、`namespace`、`metadata` |
| `response_item` | `custom_tool_call` | `type`、`name`、`input`、`call_id`、`id`、`status`、`metadata` |
| `response_item` | `function_call_output` / `custom_tool_call_output` | `type`、`call_id`、`output` 等 |
| `event_msg` | 多种 | `type` 加对应事件字段；样本中没有技能调用子类型 |
| `world_state` | 无 | `state`、`full` |

`world_state.payload.state.skills` 只有 `includeInstructions` 布尔字段；`host_skills` 只有 `body` 和 `includeInstructions`。它们描述技能说明是否被加入上下文，不包含技能名、调用时间或调用状态，不能当作调用事件。

## 候选信号

唯一可定位到具体技能的候选信号，是 `response_item` 工具调用的 `arguments` 或 `input` 中出现技能目录下的 `<name>/SKILL.md`。顶层 `timestamp` 可换算为 epoch day，路径中 `SKILL.md` 的父目录可作为技能名。

全量快照中，16,762 条 `function_call` / `custom_tool_call` 记录里只有 33 条包含此类路径，共出现 68 个技能路径引用。引用分散在 `exec_command`、`js` 和 `exec` 等不同封装中；22 条记录引用 1 个技能，5 条同时引用 2 个，6 条同时引用 6 个。没有出现类似 Claude Code `Skill` 工具的专用工具名，也没有 `skill_name`、`skill_invocation` 等显式字段。

## 可靠性判定

该候选信号不满足采集要求：

1. **语义不确定，存在误报。**读取 `SKILL.md` 可能表示按技能说明执行，也可能是审查、编辑、迁移、创建或批量比较技能。日志只记录通用工具调用，无法从字段结构区分这些意图。单条调用批量引用多个技能也说明“出现路径”不等于“每个技能被实际采用”。
2. **覆盖不完整，存在漏报。**该信号依赖代理确实通过被记录的通用工具读取文件。不同 Codex 版本、插件技能、非标准技能根目录、已注入或缓存的说明、间接脚本以及 `--no-session-persistence` 会话，都可能没有可匹配的读取记录。
3. **解析方式不稳定。**路径可能嵌在序列化 JSON、PowerShell/Bash 命令或 JavaScript 工具编排源码中。可靠识别需要理解各工具参数的语法和是否实际执行，而不是对字符串做路径正则；目前日志没有统一的结构化读取目标字段。
4. **可用性快照不能补足。**`world_state.skills.includeInstructions` 和 `host_skills` 只证明技能说明机制存在或被注入，不证明某个技能在某时刻被调用。

因此，把 `SKILL.md` 路径出现次数并入策展报告会同时制造假调用和漏掉真调用，可能进一步影响“建议隔离”裁决。按工单约束，本次不修改 `usage.rs`，也不修改 `curation.rs` 的 `data_source`；E5 继续如实保持为仅采集 Claude Code transcript。

## 可复核方法与后续方案

复核时应逐行结构化解析上述两个会话目录，只统计顶层键、`type`、`payload.type` 和 payload 字段名。候选信号检查必须限制在 `response_item/function_call.arguments` 与 `response_item/custom_tool_call.input`，排除消息、推理、工具输出和补丁正文；输出时只保留工具名、技能名和时间戳是否可解析，不输出原始参数。

未来满足以下任一条件后，可重新走路径 A：

- Codex 会话协议新增稳定的 `skill_invocation`（或等价）事件，至少结构化提供 `skill_name` 与 `timestamp`。
- Codex 技能路由器提供显式 hook，在完成路由时写入独立、可关闭的本地审计 JSONL；每条只含技能名和时间戳。
- 项目提供用户明确启用的调用包装器，由包装器在实际加载技能时记录上述最小事件，并对“不持久化会话”行为作出明确说明。

届时采集器应同时扫描 `sessions` 和 `archived_sessions`，复用现有按文件路径、大小和 mtime 的 `FileCache`，保留 300 MB 单文件护栏与单条失败跳过，并且仍只把技能名和 epoch day 写入状态。
