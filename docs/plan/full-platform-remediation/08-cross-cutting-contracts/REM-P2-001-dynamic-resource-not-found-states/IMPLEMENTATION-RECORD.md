# REM-P2-001 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`。
- 规划基线：`lint-fix@842dc84f`。
- 来源缺陷：`BUG-FQA-009`、`BUG-FQA-042`、`BUG-FQA-043`；用例：`AUTH-009`、`P-042`、`CMDB-032`、`DEVICE-001`、`IPAM-001`、`COMMON-012`。
- 根因聚类：页面 query error 分支不完整，后端不存在合同在 400/403/404 之间漂移。
- GitNexus：索引已刷新至当前规划基线并完成领域 query；尚未编辑业务符号，因此未伪造逐符号 impact 结果。
- 代码、数据、容器：未修改、未启动、未创建测试对象。
- 下一步：认领独立分支后读取本事件全部文档，对候选符号逐项执行 upstream impact，再从 `AC-001` 开始。

## 追加规则

后续只追加状态变化、实际文件/符号、impact、提交/diff、测试命令、证据、清理、回滚和剩余风险；不得覆盖历史记录。

## 2026-07-16：认领、复现与高风险边界

- 基线：`lint-fix@c97d63e`；分支：`codex/rem-p2-001-dynamic-resource-not-found-states`；状态：`IN_PROGRESS`。
- 真实 API 只读复现（superadmin）：不存在文件详情/预览为 HTTP 403，`errorCode=RESOURCE_NOT_FOUND`；设备/IPAM 详情为 HTTP 400；CMDB impact 的 GET 为 HTTP 500，但该端点仅支持 POST，不能作为业务不存在证据，需按真实 POST 合同复验。
- GitNexus upstream impact：四个候选前端页面均 0 个直接上游/LOW；`ImpactAnalysisService.analyze` 1 个直接 Controller 调用/LOW；`DeviceService.getById` 2 个直接调用者、1 个 create 流程/LOW；`IpPoolService.getById` 1 个直接调用者/LOW。文件 `SharedFileController.requireResource` 有 8 个直接调用者、影响 createFolder/upload/listFiles 等 3 条流程/HIGH，禁止直接修改该通用方法。
- 等待用户确认：目标动态详情路径是否统一为“不存在=404（含 RESOURCE_NOT_FOUND）、存在但无权限=403”。文件若按该合同需在资源 ACL 判断前确认存在性，可能暴露对象存在与否；未获确认前不修改代码。

## 2026-07-16：合同确认、实现与 L1-L3 复验

- 产品合同确认：共享文件维持不可枚举（不存在与无权均为 `403`）；设备、IPAM、CMDB impact 为不存在 `404`、无权 `403`。未修改 `SharedFileController.requireResource` 或其授权顺序。
- GitNexus upstream impact：`DeviceService.getById` 为 2 个直接调用者、1 条流程、LOW；`IpPoolService.findPoolOrThrow` 为 7 个直接调用者、1 条流程、MEDIUM；`ImpactAnalysisService.analyze` 为 1 个 Controller 调用、LOW；四个页面函数均 0 个直接上游、LOW。`BusinessException` 为 31 个直接调用者、8 条流程、CRITICAL，因此未扩展公共异常类，服务内直接使用已有构造器。
- 实现：设备、IPAM、CMDB impact 的不存在统一为 `404/RESOURCE_NOT_FOUND`，组范围拒绝为 `403/RESOURCE_FORBIDDEN`；IPAM 的内部可访问性过滤同步接住 `BusinessException`。共享文件仍返回 `403/RESOURCE_NOT_FOUND`，预览页改为中性、可重试、可返回列表且禁用下载；四个页面按 404/403/暂时失败分别渲染，CMDB impact 不再吞掉请求异常；移除通用 API 拦截器对所有 403 的 `console.warn`。
- L1 静态：`backend/mvn -q -DskipTests compile`、前端定向 `eslint`、`npx tsc --noEmit` 均通过；`docker compose -f docker-compose.dev.yml build backend frontend` 通过，随后仅重建 backend/frontend，未清 Redis、会话或数据卷。
- L2 API：superadmin 对不存在设备、IPAM、CMDB impact POST 均得到 `404/RESOURCE_NOT_FOUND`；不存在共享文件详情与预览均得到 `403/RESOURCE_NOT_FOUND`。未创建测试数据，无清理对象。
- L3 UI：经 `http://localhost` 网关复验四个不存在直达路由均结束 loading 并显示目标错误态与适用的重试/返回入口。浏览器仅记录预期 HTTP 403/404 网络条目；无 React/框架异常或应用 `console.warn/error`。
