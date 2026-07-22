# REM-P1-019 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | FILE-005 | L1 | 2026-07-15 API：合法 PDF 上传、当前目录即时可见、删除后列表为空 | `PASS` |
| `AC-002` | FILE-008 / FILE-013 / FILE-014 | L2 | API：空文件/`.exe` 返回 400；规范名冲突返回 409；UI 上传和删除均通过 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 20MB/白名单/规范名、事务锁与局部唯一索引；每次测试对象均由产品 API 精确清理 | `PASS` |
| `AC-004` | 受影响模块 | L3 | Docker Java 21 构建通过；前端 `typecheck`、`lint`（0 error）和 `git diff --check` 通过 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 低/中风险 impact 已记录；API/UI runId 测试与目录均已清理 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-065`、`BUG-FQA-066`、`BUG-FQA-068`、`BUG-FQA-100` 对应章节。2026-07-15 本机 Maven 单测受 Java 26 与项目 Mockito/Byte Buddy（最高支持 Java 24）兼容性阻断；Docker Java 21 编译、真实 API 和 UI 验收均已通过。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。
