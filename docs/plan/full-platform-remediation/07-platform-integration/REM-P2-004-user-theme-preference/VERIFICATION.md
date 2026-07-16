# REM-P2-004 验证与证据矩阵

## 验收映射

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | HOME-008 | L1 定向 | Header 用户菜单提供浅色、深色、跟随系统入口；`npm run lint -- --no-warn-ignored ./src/components/layout/Header.tsx ./src/app/providers.tsx ./src/app/layout.tsx` 通过 | `PASS` |
| `AC-002` |  | L2 根因聚类 | `ThemeProvider` 以 class 属性应用 light/dark/system；`npm run typecheck -- --pretty false` 通过 | `PASS` |
| `AC-003` | 边界 / deny / 无副作用 | L2 | Playwright：深色切换后刷新仍保持，切回浅色与跟随系统均生效；仅写浏览器本地偏好，未创建业务数据 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前源码重建 frontend 容器后，Playwright 在 `/reports`、`/wiki/8/87`、`/workflow/design` 均确认深色 class，Console error 为零 | `PASS` |
| `AC-005` | GitNexus / cleanup / rollback | L3 | `detect-changes --scope all`：RootLayout、Providers、Header 三个预期符号；总风险 `MEDIUM`，无 HIGH/CRITICAL；回滚为移除 ThemeProvider、Header 主题组和暗色 token | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新发布候选 run | `PENDING` |

## 原始失败证据

历史结论位于 `defects.md` 的 `BUG-FQA-027` 章节及 `test-results/FQA_20260712_0329_lintfix/`。修复后证据必须新建目录，禁止覆盖首次失败截图、trace 或 result。

## 执行规则

- PASS：预期、持久化、副作用、权限、审计和清理全部一致。
- FAIL：任一原始路径仍失败、出现未解释 5xx/Console error 或产生数据残留。
- BLOCKED：缺少明确授权、外部配置、独占窗口或精确清理能力；写明责任方和解除条件。
- L1→L2→L3 顺序执行；L4 是共同发布门禁。
- 清理使用产品 API 逆序执行，只删除本次 runId 对象，核对 active/cleanup_failed 均为 0。

## 2026-07-16 复验记录

- L1：定向 lint 与 typecheck 通过；前端生产镜像构建通过。
- L2/L3：以运行时提供的管理员凭据登录真实网关入口，先选深色并刷新，随后访问报表、Wiki 和 BPMN 设计器；三页均保持深色主题。再切浅色、跟随系统，偏好值为 `system`。
- Console：没有 `console.error` 或 `pageerror`。验证只修改浏览器本地主题偏好，不涉及 API 写入、数据库、对象存储或 Redis 测试数据，清理不适用。
