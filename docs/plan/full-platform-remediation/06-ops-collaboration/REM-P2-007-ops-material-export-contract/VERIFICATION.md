# REM-P2-007 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | XL-EXPORT-005 | L1 | `OpsCalendarMaterialExportTest` 覆盖工作簿结构、下载 header/MIME 与反向日期；Maven 仍由无关历史 testCompile 错误阻断 | `PASS` |
| `AC-002` |  | L2 | 真实 superadmin 会话：正常导出 HTTP 200、UTF-8 `filename*`、四类标题与 XLSX 双工作表 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 空范围 HTTP 200 且为合法双工作表；反向日期 HTTP 400；无认证 HTTP 403；全部 GET、无写入 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前事件分支 backend/frontend 容器重建、health UP；真实浏览器登录→管理→素材归集→归集→下载，中文文件名、零 Console error | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 所有候选符号 upstream LOW；`detect-changes --scope all` 仅 8 个预期符号、1 条前端页面流程；无测试数据，回滚为本事件提交 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

原始证据：`defects.md` 的 `BUG-FQA-106` 和对应 test-results。PASS 要求行为、持久化、权限、审计、清理全部一致；FAIL 包括残留、未解释 5xx/Console error；BLOCKED 必须注明解除条件。禁止覆盖历史证据。

## 2026-07-16 L1-L3 运行时证据

- 当前分支 `codex/rem-p2-007-ops-material-export-contract` 基于 `lint-fix@1b81e9fb` 构建 backend 与 frontend 容器；backend health 为 `UP`。
- 初次真实 API 暴露 Tomcat 丢弃未编码中文 `Content-Disposition` 的根因，已改为 UTF-8 `ContentDisposition.filename(..., UTF_8)`；复验同时通过 Nginx 与直接 backend 传递。
- 正常范围 `2026-05-01` 至 `2026-07-31`：HTTP 200，XLSX MIME，header 含 attachment 与 UTF-8 `filename*`，解包后存在“概览”“任务明细”工作表及“统计周期”“统计概览”“状态汇总”“任务明细”标题。
- 空范围 `2090-01-01` 至 `2090-01-31`：HTTP 200、合法双工作表；反向日期为 HTTP 400；无认证请求为 HTTP 403。所有验证只读，没有创建测试对象或审计写入。
- Playwright L3：正常登录后从 `/ops-calendar` 的“管理”菜单点击“素材归集”，执行“归集”与“导出 Excel”；最终路由为 `/ops-calendar/materials`，建议下载名为 `运维素材_2026-05-01_2026-07-31.xlsx`，Console error 数为 0。
- `mvn -q -Dtest=OpsCalendarMaterialExportTest test` 仍在 testCompile 被三项无关历史源错误阻断：OpsCalendarRuleServiceTest 缺 `SecurityUser`、OpsCalendarTaskServiceTest `insert` 重载歧义、GroupControllerGroupReferenceTest DTO 类型不匹配。生产 compile、Docker backend build 通过；前端 lint（既有 39 warnings、0 errors）和 typecheck 通过。
