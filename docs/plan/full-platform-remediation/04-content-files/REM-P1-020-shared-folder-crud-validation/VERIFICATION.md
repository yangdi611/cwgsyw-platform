# REM-P1-020 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | FILE-002 | L1 | 2026-07-15 API：目录重命名与移动 200，树状态准确回读 | `PASS` |
| `AC-002` | FILE-003 | L2 | API：空白名称 400、同级规范名冲突 409、移动到子目录 400 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 事务树锁、局部唯一索引、源/目标目录权限和 owner/ACL 保留合同 | `PASS` |
| `AC-004` | 受影响模块 | L3 | Docker Java 21 构建通过；前端 `typecheck`、`lint`（0 error）和 API/UI 真实复验通过 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | impact、产品 API runId 清理和回滚边界已记录 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-062`、`BUG-FQA-063` 对应章节。2026-07-15 本机 Maven 单测受 Java 26 与项目 Mockito/Byte Buddy（最高支持 Java 24）兼容性阻断；测试编译、Docker Java 21 构建、真实 API 和 UI 验收均已通过。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。
