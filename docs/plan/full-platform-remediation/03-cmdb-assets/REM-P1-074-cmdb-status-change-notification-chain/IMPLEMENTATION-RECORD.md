# REM-P1-074 实施记录

## 2026-07-21 发现与认领前门禁

- 来源：最终 L4 `XL-CMDB-006`。
- 复现：状态 `online -> offline` 的 API 更新和 canonical change before/after 成功，`notification_message` 精确计数为 0；产品夹具清理完成。
- GitNexus：`CiNotificationService.notifyStatusChange` upstream 风险 `LOW`，直接调用者 `0`；`CiInstanceCommandService.update` upstream 风险 `LOW`，直接调用者 `3`，影响 `Service` / `Instance` 两个模块。
- 根因：现有通知服务未接入更新命令路径。
- 预计触及：`CiInstanceCommandService`、定向单元测试、事件运行时测试与事件文档。
- 风险：批量更新与 JSON 导入复用 `update`，需要验证真实状态变化恰好一次、同状态不通知、事务失败无半写。

## 2026-07-21 事件认领

- 从 `lint-fix@1f4e313850a5dd65f91b20f0ed32ee91973737b9` 创建并恢复既定分支 `codex/rem-p1-074-cmdb-status-change-notification-chain`。
- L4 失败检查点为 `caaa5da38623839724f09fbb6e269c80840fbe1c`；仅恢复本事件五件套、专用运行时测试和相应全局台账，没有合并 L4 分支的其他改动。
- 状态推进为 `IN_PROGRESS`，事件 runId 为 `REM_P1_074_20260721`；第一门禁为最小服务接线与定向单元测试。
- 用户自有测试改动和历史 `test-results` 删除保持未暂存、未修改。

## 2026-07-22 实现与 L1-L3

- 实现：向 `CiInstanceCommandService` 注入现有 `CiNotificationService`，在 mutation 前保存 `oldStatus`；实例、审计和 canonical change 写入后，仅当持久化状态实际变化时调用 `notifyStatusChange`。batch 每个 item 使用现有 Spring transaction manager 建立独立事务，保留逐条失败继续的外部语义并消除 self-invocation 半写风险。未修改 API、状态枚举、收件人、文案、history DTO、缓存键或数据库。
- GitNexus 复核：`update` LOW，3 个直接调用方（Controller、JSON import、batch），2 个间接 Controller 入口，影响 Service/Instance，已建模流程 0；类级 LOW，2 个直接引用、1 个间接引用。
- L1：Java 21 `CiInstanceCommandServiceTest` 11/11 PASS。新增六个合同测试覆盖真实变化一次、遗漏状态、同状态、batch 每实例一次、batch 通知失败 rollback/no commit 以及直接通知异常传播。
- L2：实例/JSON import/通知定向组合 19/19 PASS；CMDB 模块排除历史 `CiChangeServiceTest` 后 76/76 PASS。组合运行暴露的 10 个错误全部为未修改 `CiChangeServiceTest.java:47` 的 strict-stubbing 历史债务，没有本事件断言失败。
- L3 build：Java 21 package PASS；仅构建并替换 dev backend，最终镜像 `sha256:0687ce22b7720308c7389ca05b15584f04e88de0d767a74f761ab7163cbad1dd`，启动 `2026-07-21T16:11:44.637207208Z`，health `healthy`。未重建数据库、Redis、MinIO、前端或数据卷。
- L3 runtime：Playwright `/tmp/rem-p1-074-runtime-r5` 1/1 PASS。真实 API 写入 `online -> offline`；只读 SQL 验证 canonical before/after 与通知计数；浏览器登录、详情 `offline` 与 history 更新记录通过；同状态二次 PUT 后通知计数不变；真实 batch 2/2 且两个实例 refId 均有通知；Console 与非 `ERR_ABORTED` 请求失败为 0。
- 数据安全：实例、模型、模型组按依赖逆序经产品 API 删除；manifest 最终 `objects=[]`、`cleanupFailures=0`，只读 active residue 为 `0/0/0`。正式 audit/change/notification 记录按产品合同保留并通过 refId 可追溯，不新增清理端点。
- 事务边界：标准 Controller/JSON import 通过 Spring 代理进入 `@Transactional update`；batch self-invocation 由每 item `TransactionTemplate` 补齐事务。通知异常为 unchecked 且不捕获，因此每条实例、审计、canonical change 和通知共享回滚结果；batch 外层继续汇总 failures。
- 回滚：删除通知服务依赖、transaction manager/每 item template、`oldStatus` 快照和条件调用即可，无迁移、数据回滚或配置恢复。
