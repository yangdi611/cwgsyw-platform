# REM-P1-016：跨模块写操作审计与快照完整性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-016` |
| 优先级 | P1 |
| 领域 | `07-platform-integration` |
| 状态 | `VERIFIED` |
| 风险 | `HIGH` |
| 负责人 | Codex remediation goal |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

IPAM、共享文件、运维等写路径缺失审计快照，CSV 导入还将非 JSON 文本写入 afterJson 并在业务写入后失败。

管理员无法通过产品审计还原变更，批量导入可能实际成功却报告失败。

## 追溯

- 缺陷：`BUG-FQA-011`、`BUG-FQA-019`、`BUG-FQA-096`
- 用例：`IPAM-002`、`IPAM-005`、`IPAM-007`、`IPAM-010`、`CMDB-IMPORT`、`AUDIT-002`
- 原始记录：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/defects.md`
- 原始证据：`test-results/FQA_20260712_0329_lintfix/` 下对应 case 目录；原证据保持只读。

## 边界

根因聚类：各模块自行拼装 AuditLog，before/after JSON、脱敏和事务顺序没有统一合同；审计 VO 也未完整暴露快照。

范围：
- 定义统一审计快照构造与脱敏规则
- 补齐关键模块 create/update/delete 快照
- 修正 CSV 导入事务与结果判定
- 受控展示 before/after

非目标：
- 不记录密码、token、密钥或文件正文
- 不回填全部历史审计
- 不把日志系统替换为事件总线

L1-L3 已通过：统一快照 JSON、脱敏与截断已接入 IPAM、CSV 导入、共享文件和运维规则；全局审计 API/UI 可受控展示快照。下一门禁：最终 L4 全量 FQA。

文件导航：[SPEC](./SPEC.md) / [验证矩阵](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)
