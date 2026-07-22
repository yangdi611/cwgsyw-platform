# REM-P1-009：CMDB 关系与实例删除引用完整性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-009` |
| 优先级 | P1 |
| 领域 | `03-cmdb-assets` |
| 状态 | `CLOSED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

关系创建允许实例自环，设备可重复关联同一 CI，实例删除会删除活跃关系并留下设备孤儿引用。

拓扑和资产引用可进入不合法状态，删除后产生不可追踪孤儿对象。

## 追溯

- 缺陷：`BUG-FQA-061`、`BUG-FQA-086`、`BUG-FQA-088`
- 用例：`CMDB-028`、`CMDB-040`、`DEVICE-003`
- 历史证据：`defects.md` 对应章节及 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

## 边界

根因：创建/删除事务缺少跨表不变量与数据库约束，onDelete 策略未在命令服务执行。

范围：
- 拒绝自环与重复设备关联
- 删除 CI 时统一执行 `restrict`：存在活跃关系或设备关联即拒绝
- 增加必要唯一/检查约束和引用摘要
- 保证失败原子性

非目标：
- 不重建全部历史拓扑
- 不自动删除无法判定归属的设备
- 不改变关系定义模型

下一门禁：逐符号 GitNexus upstream impact；`HIGH/CRITICAL` 告警后才可编辑。文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

结论：L1-L3 已通过。GitNexus `detect_changes` 确认高风险变更仅覆盖本事件的 CI 删除、关系创建、设备创建与相应流程；最终 L4 仍为共同发布门禁。

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
