# REM-P1-074 验证记录

| 层级 | 命令 / 证据 | 结果 |
|---|---|---|
| L1 | Java 21 `mvn -q -Dtest=CiInstanceCommandServiceTest test` | PASS 11/11：变化一次、遗漏/同状态静默、batch 每实例一次、batch 通知失败 rollback、直接异常传播、删除回归 |
| L2 | Java 21 CMDB 模块（排除已隔离历史 `CiChangeServiceTest`） | PASS 76/76；JSON import 与通知相关定向组合另行 PASS 19/19 |
| L3 build | Java 21 `mvn -q -DskipTests package`；dev Compose backend 单服务 build/up | PASS；镜像 `sha256:0687ce22b7720308c7389ca05b15584f04e88de0d767a74f761ab7163cbad1dd`，health `healthy` |
| L3 runtime | Playwright r5 `/tmp/rem-p1-074-runtime-r5` | PASS 1/1：真实状态更新、canonical diff、通知、详情 `offline`、history 刷新、同状态静默、batch 2/2 与每实例通知、Console/非导航取消网络错误 0 |
| 数据安全 | `REM_P1_074_20260721` manifest + 产品 API + 只读 SQL | PASS：`objects=[]`、`cleanupFailures=0`，active instance/model/group `0/0/0` |

## 验收映射

- AC-001：L1 捕获 status before/after 且通知精确一次；L3 `online -> offline`、canonical `ci_change_record` 与 `notification_message` 均通过。
- AC-002：L1 分别覆盖未提供与同状态；L3 再次 PUT `offline` 后通知计数不变。
- AC-003：L1 batch 两实例各一次且无更多交互；L3 batch API 2/2 且两个 refId 均有通知；`JsonImportServiceTest` 6/6 证明既有导入复用路径不回归。
- AC-004：标准 `update` 入口保持 `@Transactional`，通知 unchecked exception 不被吞掉；batch 每个 item 由 `TransactionTemplate` 建立独立事务，通知失败触发 rollback、不 commit，同时保留单条失败继续后续项的既有响应语义。
- AC-005：Java 21、当前分支镜像、真实 API/UI、只读持久化与精确清理均通过。

## 已知历史测试债务

- 把 `CiChangeServiceTest` 加入 L2 组合时共运行 31 项，其中本事件及其他选中测试无断言失败；该历史类有 10 个 `UnnecessaryStubbingException`，均指向未修改的 `CiChangeServiceTest.java:47` 全局 stub。
- 将该历史类隔离后，相关 19/19 与其余 CMDB 模块 75/75 均通过。本事件未修改该无关测试债务。

## L4 首次失败

- 状态更新和 `ci_change_record` before/after 通过，通知计数为 `0`。
- 证据：`test/l4-cmdb-status-notification-current-run.spec.js`，`/tmp/fqa-2050-xl-cmdb-006-failure-r4`。
- 清理：实例、模型和模型组均通过产品 API 删除。

## 修复后证据

- 专用测试：`test/l4-cmdb-status-notification-current-run.spec.js`。
- 最终事件运行：`/tmp/rem-p1-074-runtime-r5`，1/1 PASS。
- 清理清单：`test-data-manifest.json`，`objects=[]`、`cleanupFailures=0`。
- UI 说明：真实详情 API 返回 `status=offline`，页面变更历史刷新出更新记录；现有 history 读模型摘要仍显示“无实质变更”，属于事件 SPEC 明确不修改的既有 DTO/投影行为，不影响 canonical diff 与通知验收。
