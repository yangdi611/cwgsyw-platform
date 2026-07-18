# REM-P1-018 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | WIKI-016 | L1 | `WikiPageServiceTest`：完整快照回退保留正文并产生新版本；空快照在更新前拒绝；新页不创建可回退空版本 | `PASS` |
| `AC-002` | WIKI-016 原始路径 | L2 | runId `REM_P1_018_20260715_164000`：首次保存 `v1`、第二次保存 `v2`、回退 `v1` 后得到正文一致的 `v3` | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 空快照返回 409 且页面/版本不变；无认证回退 403；所有 runId 页面、空间经产品 API 删除并回读 404 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前分支重建 backend，健康 `UP`；真实 API 验证详情、版本和导出；Playwright 经 nginx 登录、版本面板确认回退、刷新正文通过。L4 回归补验 `REM_P1_018_UI2_20260718_125419`：真实点击 v1 的“导出此版本”，浏览器网络记录 `GET /api/wiki/pages/{id}/versions/1/export` 为 200，`Content-Disposition` 文件名含 `v1`；页面/空间经产品 API 删除并回读 404 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | `WikiVersionsPanel` upstream impact 为 LOW（1 个直接调用方 `WikiPageReader`、1 个流程）；导出/版本服务相邻路径为 LOW。暂存后 `detect-changes` 必须仅覆盖 Wiki 版本导出合同、回归测试和本事件台账；回滚为还原本事件提交 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-076` 对应章节。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。L4 仍待全部事件完成后的独立全平台复验。
