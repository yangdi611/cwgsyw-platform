# REM-P1-006：权限消费、兼容别名与导航可达性收敛

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-006` |
| 优先级 | P1 |
| 领域 | `01-security-authorization` |
| 状态 | `VERIFIED` |
| 风险 | `HIGH` |
| 负责人 | Codex Goal |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

权限注册表、Controller guard、前端查询开关和父级导航采用了不同资源动作，导致无权请求、孤儿权限以及有权功能不可发现。

最小权限账号可能看到错误入口、产生 403 噪音，或无法使用已被授予的能力。

## 追溯

- 缺陷：`BUG-FQA-010`、`BUG-FQA-013`、`BUG-FQA-035`、`BUG-FQA-069`、`BUG-FQA-070`、`BUG-FQA-074`
- 用例：`RBAC-006`、`RBAC-013`、`RBAC-015`、`FILE-016`、`AI-004`、`AUDIT-003`、`BACKUP-003`、`IPAM-008`
- 原始记录：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/defects.md`
- 原始证据：`test-results/FQA_20260712_0329_lintfix/` 下对应 case 目录；原证据保持只读。

## 边界

根因聚类：权限 action/alias 没有统一运行时解析；导航父组按单一资源门控，页面初始化未按权限启用查询。

范围：
- 建立 canonical action 与兼容 alias 清单
- 逐项收敛 Controller guard、页面 query enabled 和导航可见性
- 补齐缺失 consumer 的权限能力；不得下架既有可分配权限

非目标：
- 不重构统一授权引擎
- 不修改现有 assignment 数据
- 不顺带调整资源 ACL

事件级结论：L1-L3 已通过；等待最终 L4 全量 FQA，不得提前标记 `CLOSED`。

文件导航：[SPEC](./SPEC.md) / [验证矩阵](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)
