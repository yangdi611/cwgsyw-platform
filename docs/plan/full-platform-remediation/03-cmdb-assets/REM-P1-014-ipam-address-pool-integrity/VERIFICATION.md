# REM-P1-014 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | IPAM-003 | L1 | `IpPoolServiceTest` 与运行时同 CIDR、父子 overlap、并发一成一拒绝 | `PASS` |
| `AC-002` | IPAM-004 / IPAM-006 / IPAM-007 / IPAM-009 / COMMON-004 | L2 | 非法 gateway、network/broadcast、/31-/32、release→reuse、跨组 deny、管理员 UI 表单分别通过 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 跨组 list total=0；详情/utilization/allocate 均明确拒绝；并发后仅一个对象，清理为 0 | `PASS` |
| `AC-004` | 受影响模块 | L3 | JDK 21 `mvn -q test`；`npx tsc --noEmit`；`npm run lint`（0 errors，41 个既有 warnings）；当前分支 Docker backend/frontend 与 Playwright | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | GitNexus impact/detect、migration 生命周期集成验证、三批 runId 产品 API 逆序清理 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

原始证据：`defects.md` 的 `BUG-FQA-041`、`BUG-FQA-064`、`BUG-FQA-072`、`BUG-FQA-073`、`BUG-FQA-075` 和对应 test-results。PASS 要求行为、持久化、权限、审计、清理全部一致；FAIL 包括残留、未解释 5xx/Console error；BLOCKED 必须注明解除条件。禁止覆盖历史证据。

## L1-L3 执行记录（2026-07-15）

- 授权合同：用户确认“管理员必须选组；组级用户固定本组”。存量预检为活动 `ip_pool=0`，因此迁移只增加未来归属字段和约束，不回填非测试对象。
- 定向/集成：`IpPoolServiceTest`、`GroupReferenceRegistryTest`、`GroupLifecycleBlockerIntegrationTest`、`GroupLifecycleMigrationIntegrationTest` 全部通过；JDK 21 `mvn -q test` 全量通过。
- API run `REM_P1_014_20260715142115`：合法池创建 200；非法网关、CIDR overlap、network/broadcast 均为 400；allocate→release→auto reuse 返回先前地址；组级用户对其他组列表 total=0、详情/utilization/allocate 返回 `无权访问该地址池`，只能创建本组池。用户、两池均逆序清理为 0。
- API run `REM_P1_014_EDGE_20260715143026`：管理员缺 group 返回 400；/31 自动分配两个端点、/32 分配唯一地址均成功；同 CIDR 并发请求为一成一拒绝，最终仅一条，所有池 release→delete 后为 0。
- UI run `REM_P1_014_UI_1784096984324`：当前分支重建 backend/frontend，Playwright 验证管理员不选归属组不能提交、选择“数据库组”后创建唯一池且回读 `groupId=2`；无 console error，池已删除。
