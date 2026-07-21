# REM-P1-072 执行入口

只完成 `REM-P1-072：CMDB CSV 导入失败行下载`。严格遵守根 `AGENTS.md`、`CODEX-GOAL-PROMPT.md` 和本目录五件套。

必须完成：

1. 失败结果租户绑定、有界 TTL、执行后下载和 CSV 注入防护。
2. Java 21 L1、根因 L2、当前分支 backend 构建替换与真实 Playwright L3。
3. 产品 API 精确清理所有 `XL-EXPORT-004` runId 对象，manifest `0/0`。
4. 提交前运行 GitNexus `detect_changes()`，提交后从最新 `lint-fix` 以 `--no-ff` 合并。
5. 合并后仅在同一 L4 run affected-only 重验 `XL-EXPORT-004`，保留不受影响 PASS。

禁止直接 SQL、Redis、对象存储删除，禁止修改其他 L4 case，禁止 push、restore、purge 或全租户授权切换。
