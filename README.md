# SkillCurator

策展人：个人 AI 技能（agent skills）管理软件。复刻已验证的核心管理能力，并新增唯一差异化功能——**AI 辅助管理**：用被动调用数据做两段式冗余判定（先分组、后裁决），隔离区安全淘汰，让 20+ 技能存量"用得清楚、留得值得"。

- 产品规格：`docs/PRD-v1.md`（2026-08-10 定稿）
- 决策记录：`docs/decisions.md`（D1-D6，每项含理由与否决方案）
- 技术栈：Tauri 2 + React + TypeScript

## 开发

```bash
npm install
npm run tauri dev
```

> 本项目为个人学习项目（AI 产品实习训练），从零自建；skills-manager 开源项目仅作架构参考，不复用其代码。
