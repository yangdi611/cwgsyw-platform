# REM-P2-004：用户主题切换与偏好持久化

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-004` |
| 优先级 | P2 |
| 领域 | `07-platform-integration` |
| 状态 | `NOT_STARTED` |
| 风险 | `LOW` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

应用没有可见主题开关或统一 ThemeProvider，已有深色适配能力无法通过产品入口使用。

用户不能选择外观，报表、Markdown 和 BPMN 的深色可读性无法验收。

## 追溯

- 缺陷：`BUG-FQA-027`
- 用例：`HOME-008`
- 原始记录：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/defects.md`
- 原始证据：`test-results/FQA_20260712_0329_lintfix/` 下对应 case 目录；原证据保持只读。

## 边界

根因聚类：providers.tsx 未提供应用级主题状态，页头/个人菜单也没有切换控件。

范围：
- 接入统一 ThemeProvider
- 提供可发现的 light/dark/system 切换
- 持久化偏好并覆盖主要可视化

非目标：
- 不重新设计颜色体系
- 不改变用户后端资料 schema
- 不修复与主题无关的页面布局

下一门禁：实施前逐符号 GitNexus upstream impact；`HIGH/CRITICAL` 先告警。完成 L1-L3 后进入 L4 全量 FQA。

文件导航：[SPEC](./SPEC.md) / [验证矩阵](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)
