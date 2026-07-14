# REM-P1-003 验证与证据矩阵

原始失败：`BUG-FQA-056`，证据为 `test-results/FQA_20260712_0329_lintfix/RBAC-003-008-MEMBERSHIP-MATRIX/result.json`。

| AC | 用例 | 层级 | 结果 | 修复后证据 |
|---|---|---|---|---|
| `AC-001` | non-business group 引用拒绝 | L1 单元 | `PASS` | `mvn -q -Dtest=ActiveGroupReferenceValidatorTest test` |
| `AC-002` | 业务组 -> 未分配组及字段限制 | L1 根因回归 | `PASS` | `ActiveGroupReferenceValidatorTest#nonBusinessGroupReturnsStableInactiveContract` |
| `AC-003` | 无法创建未分配组 membership | L2 API | `PASS` | `test-results/REM_P1_003_probe_20260714_194856_fqa056/REM-P1-003/add-unassigned-response.json`；HTTP 409 / `GROUP_REFERENCE_INACTIVE` |
| `AC-004` | 无混合关系及清理 | L3 组织域 | `PASS` | 运行时 `REM_P1_003_` 活动用户/组计数均为 0；`detect_changes` 为 `No changes detected` |
| `AC-005` | 发布候选版全量验收 | L4 | `PENDING` | 最终 FQA run |

关闭条件已满足：`AC-001..004` PASS，probe 用户通过产品 API 删除，活动 `REM_P1_003_` 用户/组均为 0。本事件为前序整改覆盖复验，未新增生产代码；`AC-005` 始终保留为最终全量门禁。
