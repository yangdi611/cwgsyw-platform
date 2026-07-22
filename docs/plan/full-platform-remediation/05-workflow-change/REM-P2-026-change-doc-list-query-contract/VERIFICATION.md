# REM-P2-026 验证矩阵

| AC | 层级 | 检查 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | L1 | Service/Controller 查询、组合、分页 | PASS | `mvn -Dmaven.test.skip=true package` 通过；`npm run typecheck` 通过；`npm run lint` 退出 0（仅仓库既有 39 条 warning）。 |
| AC-002 | L2 | 真实会话 API 空关键词与 tenant 隔离读 | PASS | 当前分支容器：无筛选 `total=2`，`status=approved` 正确；不匹配 keyword 返回空页；`keyword=CHG&page=1&size=1` 正确；`page=0&size=1000` 钳制为 `page=1,size=100`。 |
| AC-003 | L3 | 当前分支页面搜索、状态、分页、详情 | PASS | 19 条 runId 草稿形成 21 条总记录；搜索/草稿筛选均为 19；全部列表进入 `2 / 2`；详情抽屉可打开；请求均 200、Console error=0。19 条草稿已产品 DELETE 清理，keyword 回读 `residue=0`。 |
