# REM-P1-002 验证与证据矩阵

源失败证据：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/defects.md` 的 `BUG-FQA-016`；原始 API 证据：`test-results/FQA_20260712_0329_lintfix/GROUP-CRUD/api-summary.json`。

| AC | 合同 | 层级 | 结果 | 修复后证据 |
|---|---|---|---|---|
| `AC-001` | 用户维度 membership 列表过滤 soft-delete | L1 单元测试 | `PASS` | `mvn -Dtest=GroupMembershipServiceTest test` |
| `AC-002` | 组成员列表只读活动 membership | L2 Mapper/服务复核 | `PASS`（源码复核） | `UserGroupMembershipMapper.findUserIdsByGroup` |
| `AC-003` | 添加后移除，两个列表均为空 | L2 API 回归 | `PASS` | `test-results/REM_P1_002_20260714_172525_fqa016/REM-P1-002/api-lifecycle-result.json`；双组添加、非主组移除和主组移除后，两种读取端点均只返回活动关系 |
| `AC-004` | 主组、多组、软删除用户与有效 group scope 一致 | L3 模块回归 | `PASS` | `test-results/REM_P1_002_20260714_172650_fqa016/REM-P1-002/soft-deleted-user-result.json`；`AuthorizationPersistenceIntegrationTest#effectiveAssignmentQueriesUseTheSameRuntimeContract` PASS |
| `AC-005` | 发布候选版全量验收 | L4 | `PENDING` | 最终 FQA run |

关闭条件：`AC-001..004` PASS、无未解释副作用、`detect_changes` 仅覆盖预期读模型/测试、事件卡与索引同步。`AC-005` 是所有整改完成后的统一发布门禁，不在单事件中伪造 PASS。

清理证据：`test-results/REM_P1_002_20260714_172525_fqa016/REM-P1-002/cleanup.json` 与 `test-results/REM_P1_002_20260714_172650_fqa016/REM-P1-002/cleanup.json` 均确认活动测试用户、活动测试组为 `0`。`AC-005` 继续保留为最终统一全量复验门禁。
