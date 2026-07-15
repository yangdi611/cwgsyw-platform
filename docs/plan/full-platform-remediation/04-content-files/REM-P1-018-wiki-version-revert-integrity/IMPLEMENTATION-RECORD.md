# REM-P1-018 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-076`；用例：`WIKI-016`。
- 根因：WikiPageVersion 快照写入/读取与 revert→savePage 映射未保证正文、标题和版本元数据完整。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始，追加 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-15：事件认领

- 状态：`IN_PROGRESS`；基线：`lint-fix@67f548e77fc952d4d1e655b1b43ebf9f5334fdff`；分支：`codex/rem-p1-018-wiki-version-revert-integrity`；运行标识：`REM_P1_018_20260715_164000`。
- 预计范围：`WikiPageService` 的版本快照、保存与回退路径，以及相关 Controller/Service 测试和 Wiki 运行时复验。
- 第一门禁：对候选符号完成 GitNexus upstream impact，确认原始 WIKI-016 根因后才编辑。

## 2026-07-15：根因确认与 L1 通过

- GitNexus upstream impact：`WikiPageService.savePage#4` LOW（2 个直接调用方：保存与回退入口）；`revert#4` LOW（1 个直接调用方）；`saveVersion#4` LOW（2 个直接调用方、1 条 Wiki 创建流程）。未出现 HIGH/CRITICAL 符号级风险。
- 历史失败路径与当前实现一致：回退将版本标题与正文传给 `savePage`，快照保存也保留正文。用回归测试固定该不变量：回退后的页面正文、返回值和新版本快照必须等于目标版本正文。
- 空白标题或正文的历史/旧格式快照现在在页面写入前受控拒绝，避免返回成功却清空正文；拒绝路径不更新页面、不生成新版本。
- `mvn -q -Dtest=WikiPageServiceTest test` 与后端 `mvn -q test` 通过；当前事件分支已执行 `docker compose -f docker-compose.dev.yml up -d --build backend`，健康检查 `UP`，未触碰数据库、Redis、MinIO 或卷。
- L3 尚未结算：当前执行环境没有运行时 `FQA_SUPERADMIN_PASSWORD`，且浏览器控制服务不可用；依合同不在命令、文件或日志写入凭据。待安全注入环境变量并恢复可用浏览器后，使用真实会话完成版本回退、详情、导出、无权拒绝和产品 API 精确清理。

## 2026-07-15：L1-L3 实施与复验通过

- 根因已修复：创建空页面曾直接生成空 `v1`，原始 WIKI-016 的首次、第二次保存实际形成 `v2/v3`，回退 `v1` 会得到空正文。新页面现在从版本 `0` 开始，不创建可回退的空快照；首次保存成为完整 `v1`。
- 兼容与失败合同：完整版本回退会复用保存事务，保留标题、正文、反向链接和审计，并生成新的完整版本；历史空/旧格式快照返回 409，且不更新页面、不写入新版本。
- L2 API：`REM_P1_018_20260715_164000` 完成 `v1 -> v2 -> revert(v1) -> v3`，回退响应与详情正文一致、版本列表为 `1,2,3`、Markdown 导出含目标正文；未认证回退 403；页面和空间均经产品 API 删除并验证 404。
- L3 UI：使用独立 Playwright Chromium 经 `http://localhost` nginx 登录，打开版本历史、确认回退并刷新，页面正文恢复；临时 UI 夹具在 finally 中经产品 API 精确清理。前端直连 `:3001` 不代理 `/api`，已改用 nginx 作为真实产品入口。
- 验证：`mvn -q -Dtest=WikiPageServiceTest test`、后端 `mvn -q test`、`npx tsc --noEmit`、`npm run lint` 通过；lint 为 0 error / 41 个既有 warning。当前分支 backend 已重建，健康检查 `UP`。
- 提交前 `detect-changes` 识别 9 个文件、6 个符号与 9 条 Wiki 创建流程，整体为 HIGH；范围均为初始版本语义及其回归测试，未扩展到非 Wiki 模块。
- 回滚：revert 本事件提交即可恢复先前版本编号和快照行为；未修改数据库 schema、非测试 ACL、Redis、卷或非测试数据。
