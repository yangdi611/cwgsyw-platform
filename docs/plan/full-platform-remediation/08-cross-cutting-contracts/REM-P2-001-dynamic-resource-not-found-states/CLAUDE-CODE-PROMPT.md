# REM-P2-001 Claude Code 执行入口

你现在位于 `/Users/byron/AI/cwgsyw-platform`，只持续完成 `REM-P2-001：动态资源不存在与错误态收敛`。从 `IMPLEMENTATION-RECORD.md` 第一个未完成门禁继续；不要新建另一套 SPEC，不处理其他 REM 事件。

## 必读顺序

1. `AGENTS.md`、`CLAUDE.md` 与触及目录的更深规则。
2. `docs/standards/code-quality-baseline-rules.md`、`docs/standards/code-review-checklist.md`。
3. `docs/plan/full-platform-remediation/README.md`、`INDEX.md`、`FQA-COVERAGE-MATRIX.md`。
4. 本目录的 `README.md`、`SPEC.md`、`VERIFICATION.md`、`IMPLEMENTATION-RECORD.md`。
5. `defects.md` 中 `BUG-FQA-009`、`BUG-FQA-042`、`BUG-FQA-043` 及其原始证据。

## 已批准合同

目标：动态资源不存在与错误态收敛。范围仅限：定义统一 not-found/forbidden/error 映射；所有相关页面结束 loading 并显示可恢复错误态；消除预期 4xx 的未解释 Console 噪音。非目标：不改变资源授权判定；不恢复已删除资源；不统一改造全部动态路由。

保持租户隔离、既有成功响应、权限拒绝、审计脱敏、会话和数据库兼容；不得临场扩大产品语义。

## 强制门禁

- 检查 branch、commit、工作区并保留用户改动。
- 先 GitNexus query/context；编辑每个符号前运行 upstream impact。`HIGH/CRITICAL` 必须告警。
- 最小根因改动；不混入依赖升级、全局格式化或其他缺陷。
- 完成后运行定向、聚类、模块测试与 `detect_changes`。
- 测试对象带 remediation runId，只通过产品 API 精确清理。
- 不提交、不 push、不切换全租户授权、不 restore、不清空会话，除非用户另行明确授权。

## 完成定义

逐项结算 `AC-001..006`，回写本目录四份状态文档及总索引。原始 run 只追加映射。存在不可逆数据、合同冲突、非测试对象修改或未解释 5xx 时停止并标记 `BLOCKED/FAIL`；L4 未执行时不得标记 `CLOSED`。
