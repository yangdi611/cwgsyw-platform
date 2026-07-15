# REM-P1-012 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-018`、`BUG-FQA-080`、`BUG-FQA-092`、`BUG-FQA-103`；用例：`DEVICE-005`、`DEVICE-007`、`DEVICE-009`、`DEVICE-010`。
- 根因：列表和详情范围裁决分叉；DTO 与数据库长度不一致；CredentialRow/Controller 生命周期不完整。
- GitNexus 已刷新并完成领域 query；未编辑业务符号，逐符号 impact 留给实施门禁。
- 未修改代码、数据库或容器，未创建测试对象。
- 下一步：独立分支认领后，从 `AC-001` 开始并追加实际 impact、diff、测试、证据、清理和回滚。

后续记录只追加，不覆盖历史。

## 2026-07-15：事件认领与影响分析

- 分支：`codex/rem-p1-012-device-credential-input-contracts`，基线：`lint-fix@6b5f223`。
- GitNexus 已刷新。`DeviceService.getById` 有设备详情与创建回读两个直接 Controller 调用；`addCredential` 直接由凭据创建 Controller 调用，依赖加密、审计与组引用校验；`create` 直接由设备创建 Controller 调用并参与组生命周期流程。
- 风险：`HIGH`。影响范围符合本事件的设备范围、凭据生命周期与输入合同；未发现需要扩大授权或修改非测试数据的语义分歧。
- 下一步：以 runId 复现跨组详情、字段长度、凭据编辑和复制反馈，再逐符号实施最小修复。

## 2026-07-15：实现、复验与事件级结论

- 范围实现：设备详情、创建、更新、删除和凭据的新增、编辑、删除、查看密码统一在服务层执行设备 group scope 裁决；组级调用者不能跨组创建设备或改组。新凭据编辑 API 使用独立 DTO，密码重新加密，审计仅记录 credential ID。
- 输入合同：设备分类/备注上限为 64/2000；凭据用户名/密码/备注上限为 128/1024/255；前端编辑与新建表单同步上限。
- 密码生命周期：浏览器 RSA-OAEP 使用 SHA-256。运行时发现 Java `OAEPWithSHA-256AndMGF1Padding` 的提供方默认 MGF1 参数与 Web Crypto 不同，已在 `CryptoService` 显式固定 SHA-256 MGF1 参数，并由 `CryptoServiceTest` 验证浏览器兼容解密。
- 自动化：新增跨组详情/创建、跨组凭据 update/delete/reveal/add 的零副作用断言，以及凭据编辑的加密和审计断言。JDK 21 全量后端测试通过；前端 typecheck 通过，lint 0 errors（41 个既有 warning）。
- 运行时：当前分支源码重建 backend/frontend 后，API 和 Playwright 均通过。组级拒绝的 HTTP 状态为既有业务错误映射 `400`，不是 `403`；错误明确且管理员回读证明零副作用。
- 测试数据：`REM_P1_012_SCOPE_20260715131228`（用户/设备/CI）与 `REM_P1_012_UI_20260715132356`（设备/CI）均按依赖逆序经产品 API 删除，最终查询为 0；未执行 SQL、Redis、卷或全局会话操作。
- 回滚：回滚本事件提交即可恢复此前 API/UI 行为；无 schema 或数据迁移。事件状态：`VERIFIED`，等待最终 L4。
