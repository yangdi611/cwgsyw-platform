# REM-P1-016 验证与证据矩阵

## 验收映射

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | IPAM-002 | L1 定向 | `mvn -q -Dtest=AuditSnapshotSerializerTest,CsvImportServiceTest,IpPoolServiceTest,SharedFileServiceTest,OpsCalendarRuleServiceTest test` | `PASS` |
| `AC-002` | IPAM-005 / IPAM-007 / IPAM-010 / CMDB-IMPORT / AUDIT-002 | L2 根因聚类 | IPAM create/allocate/release/delete 快照 API；CSV 单行 `created=1/failed=0` 与合法 JSON afterJson | `PASS` |
| `AC-003` | 边界 / deny / 无副作用 | L2 | 敏感字段递归脱敏、无效 JSON 降级；runId 实例和地址池均经产品 API 清理，库只读核对 active=0 | `PASS` |
| `AC-004` | 受影响模块 | L3 | `mvn -q test`、`npx tsc --noEmit`、`npm run lint`；当前分支 Docker backend/frontend 构建、health=UP | `PASS` |
| `AC-005` | GitNexus / cleanup / rollback | L3 | upstream impact 均 LOW/MEDIUM；`detect_changes` 为 16 files / 43 symbols / 2 audit-list flows / MEDIUM，范围符合事件合同；回滚为本事件 commit 反向合并 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新发布候选 run | `PENDING` |

## 原始失败证据

历史结论位于 `defects.md` 的 `BUG-FQA-011`、`BUG-FQA-019`、`BUG-FQA-096` 章节及 `test-results/FQA_20260712_0329_lintfix/`。修复后证据必须新建目录，禁止覆盖首次失败截图、trace 或 result。

## 执行规则

- PASS：预期、持久化、副作用、权限、审计和清理全部一致。
- FAIL：任一原始路径仍失败、出现未解释 5xx/Console error 或产生数据残留。
- BLOCKED：缺少明确授权、外部配置、独占窗口或精确清理能力；写明责任方和解除条件。
- L1→L2→L3 顺序执行；L4 是共同发布门禁。
- 清理使用产品 API 逆序执行，只删除本次 runId 对象，核对 active/cleanup_failed 均为 0。

## 2026-07-15 复验记录

- 分支与构建：`codex/rem-p1-016-cross-module-audit-snapshots@027d75f`，`docker compose -f docker-compose.dev.yml up -d --build backend frontend`；backend health `UP`。
- L1：定向 16 tests 全部 PASS；新增快照序列化、CSV 成功批次 JSON、IPAM 快照断言。
- L2/L3：IPAM runId `REM_P1_016_20260715_152337` 的 create/allocate/release/delete 均由 `/api/audit-logs` 返回可解析 before/after；CSV batch `6526bfbb-b150-4116-a0dc-6e65f28fb2be` 返回 `created=1, failed=0` 且 afterJson 合法。
- UI：Playwright 从 `/login` 真实登录后打开 `/admin/audit?module=ip_pool`，确认“变更快照”列与 IPAM 记录可见、无 console error。
- 清理：IPAM 地址池通过 DELETE API 删除；CSV 实例 id `115` 通过 DELETE API 软删除，产品读取与只读库均确认 `is_deleted=true`、active=0。未记录凭据或 token。
