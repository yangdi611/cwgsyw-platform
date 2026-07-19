# REM-P1-052 实施记录

## 2026-07-19：认领与影响分析

- 分支 `codex/rem-p1-052-cmdb-instance-reference-delete-guards`，基线 `lint-fix@73ec4273`，runId `REM_P1_052_20260719`。
- L4 `CMDB-040` 在 snapshot `4a80a9d4` 失败：活动变更文档引用 CI 时实例 DELETE 返回 200；测试对象已按产品 API 清理为零。
- GitNexus `CiInstanceCommandService.delete` upstream 为 LOW：3 direct、9 total、1 module、0 process。`ChangeDocCiLinkMapper` LOW（0 upstream），`DailyReportMapper` MEDIUM（5 direct、8 total、0 process），测试类 LOW。
- 根因：实例删除事务在行锁后只检查 `ci_instance_rel` 和 `device`，未检查活动 `change_doc_ci_link` 和日报 JSON `ci_instance_ids`。

## 2026-07-19：实现与 L1-L3

- `ChangeDocCiLinkMapper` 新增 tenant-scoped 活动 link + 活动 document join 计数；`DailyReportMapper` 新增 tenant-scoped JSONB 引用计数。`CiInstanceCommandService.delete` 在实例行锁、关系/设备检查之后、任何删除副作用之前依次拒绝文档与日报引用。
- 保持现有 HTTP 400、检查顺序、软删除、审计和变更历史合同；不级联、不自动解除引用、无 schema/迁移。
- JDK 21 L1 5/5、L2 28/28、生产 compile/build PASS。当前事件分支镜像 `sha256:6105836288...` 仅替换 backend 后 healthy，Flyway 无迁移、会话 epoch 保留、无未解释 ERROR/Exception。
- Playwright `/tmp/rem-p1-052-cmdb-reference-guards-rerun` 1/1 PASS：同一 CI 的活动文档/日报分别阻断 API/UI 删除且不新增 delete audit；产品 API unlink/update 解除后删除成功且恰好一条 audit。所有对象产品 API 逆序清理，event manifest 为零。
- 首次 Playwright 未给无主组 superadmin 显式日报 `groupId`，停在夹具创建并完整清理；最终资产显式选择现有活动业务组。Java 26 与未引用 zsh selector 两次环境/命令协调失败均未计入验证结果。
