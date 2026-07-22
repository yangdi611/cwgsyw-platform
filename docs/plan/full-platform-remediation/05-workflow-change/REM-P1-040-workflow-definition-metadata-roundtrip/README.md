# REM-P1-040：Workflow 定义元数据往返

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-040` |
| 优先级 | P1 |
| 状态 | `CLOSED` |
| 分支 | `codex/rem-p1-040-workflow-definition-metadata-roundtrip` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `L4-FLOW-007-001` |

`FLOW-007` 发现真实编辑页保存 v2 后仍返回 v1 name/category。修复在部署前安全同步 BPMN process name、targetNamespace 和 documentation；L1-L3 的单测、Java 21 构建、真实 API/UI 保存重载与产品 API 清理均通过。下一门禁为提交、no-ff 合并并重验 `FLOW-007/008`。

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
