# REM-P2-003 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | WIKI-008 | L1 | `WikiPageServiceTest` 新增标题规范、冲突与零写入合同；定向 Maven 被既有 testCompile 债务阻断 | `PASS`（生产编译、容器构建与运行时 API 覆盖） |
| `AC-002` | WIKI-008 | L2 | `REM_P2_003_20260716_134537`：trim 创建 200；空白/256 字符均 400；同级重复 409 + `WIKI_PAGE_SIBLING_TITLE_CONFLICT` | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 同 runId 并发创建为一成一冲突；runId 页面树清理后残留 0。子页创建因既有页面 ACL 403，未绕过该独立授权合同 | `PASS`（适用标题合同） |
| `AC-004` | 受影响模块 | L3 | 当前分支 backend/frontend 容器重建成功并健康；UI 实测 `maxlength=255`、空白保存禁用、计数可见、Console error=0 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | GitNexus impact、最终 detect_changes、迁移与实施记录；回滚为 revert 本事件提交（V77 触发器随回滚撤销） | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-057` 对应章节。定向 Maven 的 testCompile 被既有 `OpsCalendarRuleServiceTest`、`OpsCalendarTaskServiceTest`、`GroupControllerGroupReferenceTest` 编译债务阻断；本事件生产编译、当前分支容器构建、真实 API/UI 均已通过。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。
