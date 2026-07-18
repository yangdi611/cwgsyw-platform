# REM-P1-038 验证

| AC | L1 | L2 | L3 | 状态 |
|---|---|---|---|---|
| AC-001 | `WikiPageServiceTest` 25/25 PASS | 状态链 PASS | 当前分支 API PASS | PASS |
| AC-002 | adapter 回写由状态链覆盖 | reject -> draft -> edit -> resubmit PASS | 当前分支 API PASS | PASS |
| AC-003 | adapter 回写由状态链覆盖 | approve -> published PASS | 当前分支 API PASS | PASS |
| AC-004 | manifest 清空 PASS | manifest/absent read PASS | 产品 API PASS | PASS |
| AC-005 | Wiki 回归 | content/comments/export 3/3 PASS | 当前分支 backend healthy | PASS |

首次失败：L4 `FQA_20260718_1715_remp1029` 的 `POST /api/wiki/pages/{id}/submit` 返回 HTTP `500`；页面、空间已产品 API 清理，manifest 为零。

## 当前阻塞

当前分支 backend 构建并替换后，旧 key 的 HTTP `500` 已消除；提交改为统一 runtime 后返回 HTTP `409`，原因是当前租户没有 `wiki_page` 的可用流程 binding。只读流程定义列表仅有 `dailyReportApproval`、`test` 和与 Wiki 不兼容的临时定义；不能猜测绑定任一现有定义。此前的 `GET /api/workflow/bindings` 是不存在的旧路由，因全局异常处理显示为 500；正确的只读 `GET /api/workflow/center/bindings` 返回 200，且仅有 `daily_report` binding，确认 `wiki_page` binding 缺失。

## 补充 L1（2026-07-18）

- PASS：在 OpenJDK 21.0.11 下执行 `mvn -f backend/pom.xml -Dtest=WikiPageServiceTest test`，25 tests、0 failures、0 errors。
- 新增的定向断言覆盖统一 `wiki_page` workflow command 与 `draft -> review`/process instance 写回；当 facade 因缺 binding 失败时，页面保持 `draft`，无 page update 或 audit 写入。

## 2026-07-18 授权 L2/L3

- 授权前基线：`GET /api/workflow/center/bindings` 仅有 `daily_report`；没有 `wiki_page` binding，模板实例列表为空。
- 通过产品 API 创建 `single_approval` 模板实例 `7`（`remp1038wiki`），指定审批人 `superadmin`（ID `1`），并创建 `wiki_page` binding `2`。该临时配置用于验证，不是批准的长期审批策略。
- `FQA_L4_RUN_ID=REM_P1_038_20260718_1805 npx playwright test test/l4-wiki-state-current-run.spec.js --workers=1`：PASS。覆盖 submit 200/review、reject draft、编辑、再次 submit、approve published；manifest 为 `objects=[]` 且 `cleanupFailures=0`，`remp1038wiki` running instances=0。
- Wiki 回归：`l4-wiki-content-current-run`、`l4-wiki-comments-current-run`、`l4-wiki-export`，串行 3/3 PASS。
- 用户已明确接受当前 `wiki_page -> remp1038wiki`（binding `2`、模板实例 `7`、指定 `superadmin` 审批）为正式租户策略。该长期配置不再作为测试残留或回退 blocker；运行中实例仍为 0。
