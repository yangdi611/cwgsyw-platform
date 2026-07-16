# REM-P2-022 实施合同

## 目标

CTE 结果组装以节点第一次出现的深度为准；同一节点在循环路径后再次出现时不再加入新层。边仍保留去重后的完整集合。

## 影响

GitNexus upstream impact（2026-07-17）：`ImpactAnalysisService.analyze` 仅有 `ImpactAnalysisController.analyze` 一个直接调用方，无受影响流程，风险 `LOW`。

## 验收

- AC-001：循环图返回的所有 layer node ID 全局唯一。
- AC-002：节点保留最短深度，边集不会因去重而丢失。
- AC-003：当前分支容器 API/UI 对既有实例影响分析正常，零 Console/4xx/5xx。
