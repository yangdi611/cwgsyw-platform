# REM-P2-032 验证矩阵

| AC | 用例 | 层级 | 证据 | 结果 |
|---|---|---|---|---|
| AC-001 | 首页登录后等待变更文档查询回填 | L1/L3 | `test-results/FQA_20260717_1125_final_l4/REM-P2-032/result.json` | PASS |
| AC-002 | 列表分页 records 与空态归一化 | L1/L2 | `frontend` `npm run typecheck`、`npm run lint -- --quiet` | PASS |
| AC-003 | 登录 → 首页 → 用户菜单登出 → 受保护页回登录 | L3 | `test-results/FQA_20260717_1125_final_l4/REM-P2-032/result.json`、截图 | PASS |
| AC-004 | 只读 UI 回归 | L3 | `result.json`：零 page/console error、零失败请求 | PASS |

原始失败证据保留于最终 L4：`AUTH-001` 的首页截图及 `_.filter is not a function` 页面错误。修复后仅追加新证据，不覆盖原始结果。

通过条件：上述 AC 全部 PASS、无 console/page error、无失败请求导致的未解释崩溃，且无测试对象或清理任务产生。

## 已执行命令

- `frontend`: `npm run typecheck`、`npm run lint -- --quiet`：PASS。
- 仓库根：`docker compose -f docker-compose.dev.yml build frontend && docker compose -f docker-compose.dev.yml up -d --no-deps frontend`：PASS，当前事件分支镜像构建完成。
- 运行时：独立 Playwright Chromium 真实 `/login` → `/` 等待数据回填 → 用户菜单登出 → 受保护页 `/` 回登录：PASS；`result.json` 记录 `homeStable=true`、零错误和零业务写入。
