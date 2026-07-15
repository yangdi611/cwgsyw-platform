# REM-P1-012 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | DEVICE-005 | L1 | `DeviceServiceTest` 的跨组详情、创建和凭据写入拒绝；真实 API 组级列表 `total=0`、详情/更新/新增凭据均为 400 | `PASS` |
| `AC-002` | DEVICE-007 / DEVICE-009 / DEVICE-010 | L2 | DTO 64/2000/128/1024/255 边界返回 400；Playwright 编辑、保存、刷新、复制反馈均通过 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 跨组更新拒绝后管理员回读 category 不变；服务层覆盖 update/delete/reveal/add 凭据拒绝且不写审计或数据 | `PASS` |
| `AC-004` | 受影响模块 | L3 | JDK 21 `mvn -q test`；`npx tsc --noEmit`；`npm run lint`（0 errors，41 个既有 warnings）；当前分支 Docker backend/frontend 重建和 Playwright | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | GitNexus impact、`detect_changes`、两批 runId 产品 API 逆序清理和零残留核对 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

原始证据：`defects.md` 的 `BUG-FQA-018`、`BUG-FQA-080`、`BUG-FQA-092`、`BUG-FQA-103` 和对应 test-results。PASS 要求行为、持久化、权限、审计、清理全部一致；FAIL 包括残留、未解释 5xx/Console error；BLOCKED 必须注明解除条件。禁止覆盖历史证据。

## L1-L3 执行记录（2026-07-15）

- GitNexus upstream impact：`DeviceService.getById`、`addCredential`、`updateCredential`、`deleteCredential`、`revealPassword`、`CredentialRow.fetchPassword`、`rsaDecrypt` 和 `CryptoService.encryptForClient` 均为 `LOW`；直接调用者位于 Device 模块，未命中额外流程。事件整体仍按授权与密码生命周期评估为 `HIGH`。
- 定向与全量后端：JDK 21 下 `mvn -q -Dtest=CryptoServiceTest,DeviceServiceTest test` 和 `mvn -q test` 均通过。
- 运行时跨组夹具 `REM_P1_012_SCOPE_20260715131228`：组级用户仅能得到空列表；详情、完整更新、凭据新增均返回业务拒绝 `无权访问该设备`；管理员回读确认 category 未变化。用户、设备、CI 逆序删除后关键词查询均为 0。
- 运行时 UI 夹具 `REM_P1_012_UI_20260715132356`：当前事件分支重建 backend/frontend，Playwright 通过账号编辑、密码轮换、刷新持久化、复制成功 toast、页面无明文及无 console error；设备和 CI 逆序删除后查询均为 0。
- 初次 UI 复制验收发现 JVM OAEP 默认 MGF1 digest 与 Web Crypto SHA-256 不一致，导致解密失败且无法显示成功反馈；补齐显式参数及兼容性单测后复验通过。这是本事件范围内的密码生命周期根因，未扩大权限或加密算法边界。
