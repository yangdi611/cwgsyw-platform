# REM-P1-059 实施记录

- 基线：`lint-fix@738e2686`；事件分支：`codex/rem-p1-059-cmdb-device-bidirectional-navigation`。
- L4 失败快照：`b81a4c9d`，CI/device API 关联正确但 CI 详情无设备链接。
- 实现：`InstanceResourcesTab` 改用 API 实际字段 `id/ip/deviceType` 并生成 `/devices/{id}`；`DeviceVO` 增加只读 `ciModelCode`；`DeviceService.toVO` 从关联 CI 回填真实 model code；设备详情使用该 code 生成 CMDB 返回路由。
- GitNexus 影响：`InstanceResourcesTab` LOW；`DeviceVO` MEDIUM（5 direct/14 total）；`DeviceService.toVO#3` LOW；`DeviceDetailPage` LOW。提交前 `detect_changes(scope=all)` 检测到 11 个符号、7 个受影响流程，范围与事件合同一致。
- L1：typecheck PASS；lint 0 errors/39 warnings；Java 21 新增测试 PASS。
- L2：受影响聚类 23 项中 21 PASS；2 项既有异常类型断言差异（产品当前返回 `BusinessException`），未扩大修复范围。
- L3：Playwright 1/1 PASS，证据 `/tmp/rem-p1-059-l3-r2`；manifest 空且清理失败 0。
- 回滚：撤销前端字段映射与 `ciModelCode` 读字段；无数据迁移。
