# REM-P1-015：分页基础设施与审计筛选合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-015` |
| 优先级 | P1 |
| 领域 | `07-platform-integration` |
| 状态 | `CLOSED` |
| 风险 | `MEDIUM` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

MyBatis-Plus 分页拦截缺失导致审计和通知返回全量且 total=0，同时审计 action、操作人和关键词筛选未贯通。

列表页无法可靠翻页，审计检索结果不完整且难以定位事件。

## 追溯

- 缺陷：`BUG-FQA-023`、`BUG-FQA-024`、`BUG-FQA-040`、`BUG-FQA-054`
- 用例：`AUDIT-001`、`AUDIT-READ-FILTER`、`NOTICE-001`
- 原始记录：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/defects.md`
- 原始证据：`test-results/FQA_20260712_0329_lintfix/` 下对应 case 目录；原证据保持只读。

## 边界

根因聚类：MyBatisPlusConfig 未注册分页拦截器；Controller/Mapper/UI 未形成一致的筛选参数链。

范围：
- 补齐分页 interceptor 与 count 合同
- 实现审计 action/operator/keyword 过滤
- 验证其他 selectPage 消费者不回归

非目标：
- 不补写业务审计快照
- 不改变审计保留周期
- 不修改通知权限

L1-L3 已通过：审计与通知分页返回准确 `total` 并严格限制 records；审计 action、操作人和关键词筛选已贯通 API/UI。当前分支构建的 backend/frontend 容器健康，真实会话 API 与页面路径复验通过；未创建测试数据，无需清理。下一门禁：等待全量 L4 FQA。

文件导航：[SPEC](./SPEC.md) / [验证矩阵](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
