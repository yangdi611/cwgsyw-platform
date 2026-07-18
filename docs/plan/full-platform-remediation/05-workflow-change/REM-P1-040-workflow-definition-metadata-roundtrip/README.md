# REM-P1-040：Workflow 定义元数据往返

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-040` |
| 优先级 | P1 |
| 状态 | `VERIFIED` |
| 分支 | `codex/rem-p1-040-workflow-definition-metadata-roundtrip` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `L4-FLOW-007-001` |

`FLOW-007` 发现真实编辑页保存 v2 后仍返回 v1 name/category。修复在部署前安全同步 BPMN process name、targetNamespace 和 documentation；L1-L3 的单测、Java 21 构建、真实 API/UI 保存重载与产品 API 清理均通过。下一门禁为提交、no-ff 合并并重验 `FLOW-007/008`。
