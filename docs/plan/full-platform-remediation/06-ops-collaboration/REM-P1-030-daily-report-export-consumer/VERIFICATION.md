# REM-P1-030 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | DAILY-008 | L1 | `ReportControllerTest` 覆盖 scope/deny/date；受历史 testCompile 债务阻断，生产 `mvn -q -DskipTests compile` PASS，真实 API 定向复现 PASS | `PASS` |
| `AC-002` | export-only / 无 export | L2 | `REM_P1_030_20260716_112540`：最小 group export-only 账号本组 XLSX 200；跨组 `groupId` 403；未认证 403 | `PASS` |
| `AC-003` | 日期边界 / deny / 零副作用 | L2 | 真 API：`bad` 日期及 start>end 均 400；越权请求未导出、未新增 audit；测试用户/角色/分配经产品 API 清理，残留 0 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前分支重建 backend/frontend 容器；真实侧栏点击 `/reports`、XLSX 下载请求与无权限重定向 PASS，Console error=0 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | upstream impact 均 LOW；导出审计 `daily_report/export` 可由 `/api/audit-logs` 查询；两轮测试对象 cleanup PASS；`detect_changes` PASS | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据为 `BUG-FQA-094` 对应章节。PASS 要求行为、持久化、权限、审计、清理全部一致；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理为 BLOCKED。禁止覆盖历史证据。

## 2026-07-16 L1-L3 运行时记录

- 构建来源：`codex/rem-p1-030-daily-report-export-consumer@f659aee` 加未提交本事件差异；`docker compose -f docker-compose.dev.yml build backend/frontend` 成功，替换对应容器后 backend 与 frontend 均可用。
- 真实 API：superadmin XLSX 导出 HTTP 200、OOXML；日期格式和倒序日期均 HTTP 400；导出审计查询得到 `module=daily_report`、`action=export`、`targetType=daily_report_export` 和有效 scope/group。
- 最小权限账号按正常首次登录 setup 后，只有 `daily_report:export` 仍可导出本组，未授予 `daily_report:read`；跨组参数和无认证均为 HTTP 403。
- 浏览器门禁：通过隔离 Playwright Chromium context（经 `http://localhost` 网关）完成。export-only 用户真实展开“报表分析”并点击“综合报表”，下载 `日报汇总_2026-07-01_2026-07-31.xlsx`，请求为 `/api/reports/export?startDate=2026-07-01&endDate=2026-07-31`；无 export 用户入口隐藏、直达 `/reports` 回首页；Console error=0。UI runId `REM_P1_030_UI_20260716_113313` 的两名用户、分配和角色已产品 API 清理，残留均为 0。
