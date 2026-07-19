# REM-P1-048 执行入口

按 `docs/plan/full-platform-remediation/CODEX-GOAL-PROMPT.md` 从检查点继续本事件，不重跑未受影响 L4 PASS。

硬合同：素材归集和 XLSX 导出必须与统计使用相同有效组。`group` scope 永远强制认证用户 `groupId`，忽略空值或伪造请求组；`tenant/platform` scope 保持未传组全租户、显式组筛选。保持权限、路由、响应、文件、Service/SQL、租户和审计合同。

完成 upstream impact 后，只实施 Controller 最小修复和测试；完成 L1-L3、当前 backend、真实两组 API/UI/XLSX、产品 API 精确清理、证据回写、detect_changes、独立提交和 no-ff 合并。合并后恢复同一 L4 run `FQA_20260718_2050_remp1038`，只重跑 `OPS-017` 受影响范围并继续 NOT_RUN。若合同要求跨组导出或出现不可精确清理对象，停止请求决定。
