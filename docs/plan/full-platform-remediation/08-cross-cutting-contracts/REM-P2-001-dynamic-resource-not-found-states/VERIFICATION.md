# REM-P2-001 验证与证据矩阵

## 验收映射

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | AUTH-009 | L1 定向 | 共享文件不存在的详情/预览 API 均为 `403/RESOURCE_NOT_FOUND`；页面中性失败、重试和返回列表 | `PASS` |
| `AC-002` | P-042 / CMDB-032 / DEVICE-001 / IPAM-001 / COMMON-012 | L2 根因聚类 | 不存在设备/IPAM/CMDB impact POST 均为 `404/RESOURCE_NOT_FOUND`；三页面无框架错误 | `PASS` |
| `AC-003` | 边界 / deny / 无副作用 | L2 | 文件仍不可枚举；设备/IPAM 组范围拒绝为 `403/RESOURCE_FORBIDDEN`；未创建测试对象 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 后端生产编译、前端 eslint/tsc、容器构建与网关直达路由复验通过 | `PASS` |
| `AC-005` | GitNexus / cleanup / rollback | L3 | 增量索引与 all-scope detect-changes 已运行；本事件无数据写入；可按独立提交回滚 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新发布候选 run | `PENDING` |

## 实际命令与结果

- PASS：`backend/mvn -q -DskipTests compile`。
- PASS：`frontend/npx eslint`（仅受影响页面与 `api.ts`）及 `frontend/npx tsc --noEmit`。
- PASS：`docker compose -f docker-compose.dev.yml build backend frontend`，随后仅重建 backend/frontend。
- PASS：网关 `http://localhost` 的四条不存在直达路由呈现目标错误态；浏览器没有 React/框架异常或应用 Console 噪音，网络面板仅含预期 403/404。
- BLOCKED（既有、非本事件）：`backend/mvn -q test-compile` 被 `OpsCalendarRuleServiceTest` 缺少 `SecurityUser`、`OpsCalendarTaskServiceTest` 的 `insert` 重载歧义及 `GroupControllerGroupReferenceTest` 的 DTO 类型错误阻断；未混入修复。

## 原始失败证据

历史结论位于 `defects.md` 的 `BUG-FQA-009`、`BUG-FQA-042`、`BUG-FQA-043` 章节及 `test-results/FQA_20260712_0329_lintfix/`。修复后证据必须新建目录，禁止覆盖首次失败截图、trace 或 result。

## 执行规则

- PASS：预期、持久化、副作用、权限、审计和清理全部一致。
- FAIL：任一原始路径仍失败、出现未解释 5xx/Console error 或产生数据残留。
- BLOCKED：缺少明确授权、外部配置、独占窗口或精确清理能力；写明责任方和解除条件。
- L1→L2→L3 顺序执行；L4 是共同发布门禁。
- 清理使用产品 API 逆序执行，只删除本次 runId 对象，核对 active/cleanup_failed 均为 0。
