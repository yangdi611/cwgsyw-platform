# REM-P1-071 执行 Prompt

完整读取本目录四份事件文档。保持独立事件、L1-L3、证据、提交与 no-ff 合并纪律；仅实现 platform、同租户、精确 `remediationRunId` 标记的 CMDB 测试告警逻辑删除和审计，不得扩大为普通告警删除、跨租户清理、批量 purge 或 restore。完成 Java 21、当前分支生产 backend、真实 Prometheus mock、错误/重复拒绝、审计与精确配置恢复后，恢复同一 L4 run 并完整复跑 `CMDB-034/XL-CMDB-008`。
