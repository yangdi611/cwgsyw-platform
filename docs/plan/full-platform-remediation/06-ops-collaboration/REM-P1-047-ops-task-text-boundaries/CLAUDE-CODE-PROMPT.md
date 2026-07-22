# REM-P1-047 执行入口

按 `docs/plan/full-platform-remediation/CODEX-GOAL-PROMPT.md` 从检查点继续本事件，不重复既有 L4 PASS。

硬合同：运维任务创建标题必填，更新显式标题非空白；标题最多 255 个 Unicode code point，超长在任何写入前返回 HTTP 400；255 原样往返。任务正文为 PostgreSQL `TEXT`，没有批准的最大值，禁止临场发明限制。保持权限、状态机、schema、审计和成功响应不变。

完成 upstream impact 后实施服务、UI 和测试；完成 L1-L3、真实 API/UI、产品 API 精确清理、证据回写、detect_changes、独立提交和 no-ff 合并。合并后恢复同一 L4 run `FQA_20260718_2050_remp1038`，仅重跑受影响 `OPS-004` 并继续 NOT_RUN。遇到新产品语义、非测试数据修改或不可精确清理时停止请求决定。
