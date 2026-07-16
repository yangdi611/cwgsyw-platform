# REM-P2-024 实施合同

## 目标

影响分析页仅在 API 已返回非空 `rootModelId` 时显示 `/cmdb/instances/by-model/<modelId>/<id>` 返回链接；加载期间展示不可点击文本，绝不导航到 `_` 占位路由。

## 影响

GitNexus upstream impact（2026-07-17）：`ImpactAnalysisPage` direct callers=0、modules=0，涉及两个本页流程，风险 `LOW`。

## 验收

- AC-001：已加载 root `host` 的返回链接为 `/cmdb/instances/by-model/host/20`。
- AC-002：加载态无可点击 `_` 占位路由。
- AC-003：当前分支容器 UI 返回详情成功，Console/4xx/5xx 为零。
