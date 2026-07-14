# REM-P0-001 最终实施与复验总结

## 1. 最终结论

| 项目 | 结论 |
|---|---|
| 核心越权缺陷 | `PASS`，技术闭环完成 |
| PostgreSQL/Testcontainers | `18/18 PASS` |
| 拒绝层级矩阵 | `13/13 PASS` |
| 授权相关测试集群 | `117/117 PASS` |
| 完整后端回归 | `315/315 PASS` |
| 最新 backend L1-B | `54 PASS / 1 FAIL` |
| 事件状态 | `CLOSED` |
| 是否可标 `CLOSED` | **是** |

Claude 第三轮遗留的 assignment add 锁、旁路 assignment 写入口和集成验证已由 Codex 继续完成。最终复审又发现并修复 UserService 反向锁序死锁窗口和 role delete × assignment writer 竞态。membership 移除后 group assignment 不再参与功能 permission、highest scope 或资源级裁决；原 session、新 session 与 session touch 对 Wiki、共享文件均立即拒绝。核心缺陷和同根因回归已形成技术闭环。

事件仍不能 `CLOSED`：唯一未通过项是历史测试 groups `11..15` 无产品 delete/archive/purge，无法按产品合同精确清理。该项是清理能力设计缺失，不是授权修复失败。

## 2. 基线与证据

- branch：`lint-fix`。
- commit：`5d3c5b6f` + 未提交整改变更。
- 最新运行时 runId：`REM_P0_001_20260714_0254_lint_fix`。
- 运行时证据：`test-results/REM_P0_001_20260714_0254_lint_fix/REM-P0-001/`。
- 自动化证据：`backend/target/surefire-reports/`。
- 最新 backend 已独立 `--no-deps` 替换；PostgreSQL、Redis、MinIO、Nginx 等非 backend 容器未重启。
- backend 容器标签确认来自当前工作区 `docker-compose.dev.yml`；frontend、Nginx、Redis 的既有容器标签仍指向旧 iCloud checkout，PostgreSQL 标签来自 `docker-compose.yml`。本事件没有修改这些容器，且 L1-B 复验使用的 backend/image 与本工作区一致；该混合来源需在后续发布级环境冻结时消除。
- authorization 最终为 `enforced / epoch=1`；superadmin 未变化。

## 3. 已闭环的修复合同

1. 三条 effective-assignment 查询统一校验 assignment、role、tenant、business group、membership、scope 和有效期。
2. membership 删除在同一事务中软删除 membership、撤销匹配 group assignments、清理匹配主组并写完整审计。
3. 关键 update/insert 必须影响一行，否则抛错回滚；`deleted_at/deleted_by` 真实落库，审计摘要有界。
4. assignment/membership/migration/cutover/relationship cleanup/legacy compatibility/UserService/role delete 写路径统一使用 PostgreSQL advisory transaction lock。
5. 锁顺序统一为 `(tenant,user) → (tenant,role) → (tenant,user,group)`；获取锁后重新读取权威 user、role、membership、group 和 legacy 关系，避免快照竞态。
6. role delete 在锁后重查所有引用并条件软删除；assignment writer 与其共享 role lock，防止 active assignment 指向 deleted role。
7. tenant/platform assignment 不依赖 membership；多组独立、expiry、rejoin 不自动恢复等合同保持不变。

## 4. 验证结算

| 层级 | 结果 | 说明 |
|---|---:|---|
| PostgreSQL 集成 | `18/18 PASS` | effective 查询、事务回滚、membership/assignment、role delete、UserService 锁序交错 |
| 裁决层级 | `13/13 PASS` | 功能 permission、scope、expiry、ACL、祖先拒绝 |
| 授权相关集群 | `117/117 PASS` | Authorization、Org、RBAC、User、Wiki、SharedFile 等影响链 |
| 完整后端 | `315/315 PASS` | failures/errors/skipped 均为 0 |
| 最新 L1-B | `54/55` | 54 PASS；唯一 FAIL 为历史组清理 |
| 运行日志 | `PASS` | failed request、未解释 5xx、后端异常均为 0 |

最新运行时验证覆盖 Wiki/共享文件、原 session、新 session、session touch、tenant assignment、expiry、多组、rejoin、审计、UI/Network URL 归因与数据库回读。本轮 run 用户、角色、assignment、membership 已全部清零，active orphan group assignments 为 0。

最终自动化命令再次返回 `BUILD SUCCESS`。完整后端输出中的 Redis unavailable 堆栈来自 `AuthSessionServiceTest` 的预期异常断言；Surefire 在全部 315 条用例结算后打印 fork JVM 关闭超时，但 Maven 退出码为 0，且 XML 汇总为 failure/error/skipped 均 0。最终机器可读摘要见运行证据目录中的 `final-reverification.json`。

## 5. GitNexus 风险结论

最终 `detect_changes(scope=all)`：

- 20 个已跟踪变更文件；
- 90 个 changed symbols；
- 9 条 affected processes；
- aggregate risk：`HIGH`。

最终复验先重建 GitNexus 索引到 9,991 nodes / 21,715 edges / 300 flows，新增 `AuthorizationWriteLockService` 已可查询；该服务为 `MEDIUM`，13 个上游符号、8 个直接消费者。`detect_changes` 的 9 条流程覆盖 Wiki、共享文件、migration 与 relationship cleanup 等预期链路，未发现新的越界模块。重建前的 `CRITICAL / 92 / 23` 是旧索引结果，不再作为最终分母。`git diff --check` 通过。

## 6. 唯一阻塞与解除条件

历史整改 groups `11..15` 属于本事件前序测试数据，但产品没有 group delete/archive/purge。未经明确授权不得直接 SQL 清理，也不得将它们伪报为已清理。

满足以下任一条件后，才能重跑清理断言并把事件从 `BLOCKED` 更新为 `CLOSED`：

1. 产品提供可审计的 group archive/delete/purge；或
2. 用户明确批准只对已核验 groups `11..15` 做受控精确清理，保留执行前后快照和审计证据。

## 7. 发布门禁

实时全量主功能 `275` + 状态/跨模块 `78` 属于发布候选版 L4 门禁，不要求每次单事件返修重跑。本轮没有伪称执行 L4；发布关闭前仍须按实时分母完成该回归。

## 8. Closure Addendum（2026-07-14）

`REM-P1-001` 完成产品级可审计 group archive 后，经用户批准 archive groups `11..15`，审计 ID 为 `7422..7426`。五组历史 membership/assignment 数量与 ID 边界保持不变。随后仅复跑本事件 `AC-012`，10/10 清理与不变量检查 PASS；其余 13 个 AC 复核既有 PASS 证据，未重跑。

最终结算为 `PASS=14 / FAIL=0 / BLOCKED=0 / N/A=0`。authorization 保持 `enforced / epoch=1`，superadmin 指纹不变，active orphan assignment、P0 session 和活动对象均为 0。证据：`test-results/REM_P0_001_20260714_0254_lint_fix/REM-P0-001/ac-012-recheck/result.json`。

最终准确表述：**REM-P0-001 已形成完整闭环，事件状态 CLOSED。发布候选版 L4 `275+78` 仍为独立版本门禁。**
