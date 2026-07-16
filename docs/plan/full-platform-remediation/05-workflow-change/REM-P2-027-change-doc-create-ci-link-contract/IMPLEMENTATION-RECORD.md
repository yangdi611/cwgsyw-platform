# 实施记录

## 2026-07-17：L4 发现、认领与影响分析

- 原始 L4：真实页面选择 CI `#32` 后创建草稿 `#198`，详情 `GET /api/change-docs/198/ci-links` 为 HTTP 200 空数组；草稿已通过产品 DELETE 清理。
- GitNexus upstream impact：`CreateChangeDocRequest` 无 direct caller；`ChangeDocService.create` 的唯一 direct caller 为 `ChangeDocController.create`；`ChangeDocLinkService.linkCiInstances` 无 direct caller，均为 `LOW`。
- 实施：创建 DTO 增加 `ciSnapshots`；`ChangeDocService.create` 在文档插入后复用 tenant 校验、去重和审计能力的 `ChangeDocLinkService`。事务失败会回滚已插入草稿。
- 测试数据：尚未创建本事件 runId 对象；后续所有对象仅通过产品 API 精确清理。

## 2026-07-17：L1-L3 验证完成

- L1：后端 Maven 打包成功；前端 typecheck/lint 成功，lint 仅为仓库既有 39 条 warning。
- L2：真实认证会话创建空 CI 草稿 #200 成功；不存在 CI #999999999 返回 HTTP 400，未创建草稿；#200 已通过产品 DELETE 清理。
- L3：从当前分支源码重建 backend/frontend/nginx 容器并健康。真实页面选择模板、填写动态字段、选择 CI #32 后创建 #199；`ci-links` 回读 1 条，Console 和应用 API 4xx/5xx 均为 0。#199 已通过产品 DELETE 清理。
- 清理：runId 关键词回读无非法草稿，所有本事件文档对象清理完成；未改模板、既有 CI、授权、数据库卷、Redis 或会话。
