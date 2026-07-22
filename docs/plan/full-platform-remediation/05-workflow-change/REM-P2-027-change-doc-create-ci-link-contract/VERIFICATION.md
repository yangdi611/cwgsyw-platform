# REM-P2-027 验证矩阵

| AC | 层级 | 检查 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | L1 | DTO、事务创建与链接委托 | PASS | `backend: mvn -Dmaven.test.skip=true package` 通过；`frontend: npm run typecheck`、`npm run lint` 通过（既有 39 条 warning）。 |
| AC-002 | L2 | 会话 API 正向、空 CI、非法 CI 与无残留 | PASS | 当前分支容器：空 `ciSnapshots` 创建草稿 #200 成功；不存在 CI 返回 HTTP 400，关键词回读 `total=0`；#200 已产品 DELETE 清理。 |
| AC-003 | L3 | 真实页面模板/字段/CI/详情/清理 | PASS | 当前分支容器 Playwright：选模板、必填字段和 CI #32 后创建草稿 #199，`GET ci-links` 返回 1；Console/API 4xx/5xx=0；#199 已产品 DELETE 清理。 |
