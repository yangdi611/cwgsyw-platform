# REM-P1-011 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | CMDB-019 | L1 | 中文“应用”模型下载：单次 `%E5%BA%94%E7%94%A8`、200、CSV MIME、UTF-8 文件名、零 Console error | `PASS` |
| `AC-002` | CMDB-022 / CMDB-023 / CMDB-037 / XL-CMDB-009 | L2 | update-only API/UI allow、deny 403、rack 目录/2D/动态详情/机柜视图均 PASS | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 临时 rack、角色、role assignment、allow/deny 用户均经产品 API 逆序清理，检查无 runId 残留 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前分支 Docker 前端/后端生产构建、健康容器与真实浏览器/API 复验 PASS | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 全部 upstream impact LOW；`detect_changes` 仅命中预期 4 条 CMDB 流程，MEDIUM 汇总风险已覆盖 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

原始证据：`defects.md` 的 `BUG-FQA-039`、`BUG-FQA-087`、`BUG-FQA-095` 和对应 test-results。PASS 要求行为、持久化、权限、审计、清理全部一致；FAIL 包括残留、未解释 5xx/Console error；BLOCKED 必须注明解除条件。禁止覆盖历史证据。
