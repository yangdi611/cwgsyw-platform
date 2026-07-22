# REM-P1-058 实施记录

## 2026-07-20：认领、数据前置与根因确认

- 基线 `lint-fix@cd903e7b`；分支 `codex/rem-p1-058-group-active-name-uniqueness`；failure snapshot `592f775c`；事件 runId `REM_P1_058_20260720`。
- 同 run L4 创建第一个活动业务组返回 200，完全同名的第二次创建也返回 200；两组随后经产品 API 归档，active marker 为零，未 restore 或 purge。
- 只读数据库核验分别按 `(tenant_id,name)` 和 `(tenant_id,btrim(name))` 检索活动重复，均为零；因此新增约束不需要历史数据修改。迁移仍带显式冲突门禁，发现历史重复会原子失败。
- GitNexus：create LOW 0 direct；update LOW 1 direct；GroupMapper HIGH 24 direct / 40 total；lifecycle gate MEDIUM 31 total；exception handler LOW 4 direct。已向用户报告 HIGH 共享接口风险，范围收敛为单一新查询和两个 Controller 消费点。

## 2026-07-20：实现与 L1

- create/update 在既有 trim 后查询同租户活动名称冲突；失败在写入前返回 400，更新对象保持不变。
- V78 增加 `(tenant_id,btrim(name)) WHERE NOT is_deleted` partial unique index和历史冲突门禁；跨租户、归档复用及大小写合同保持不变。
- restore 预检新增名称 blocker；预检后的并发冲突只识别新约束 marker 并映射为生命周期 409，不吞掉其他完整性异常。
- Java 21 定向测试 25/25 PASS：Controller 3、生命周期 14、异常映射 6、迁移/并发 2；backend compile 和 `git diff --check` PASS。
- 首轮默认 Java 26 因 Mockito/ByteBuddy 仅支持至 Java 24而失败；迁移 2/2 与异常映射 6/6 当轮已通过。按项目 Java 21 基线重跑后全部通过，未改依赖或测试门槛。
- 首轮 org/group 聚类 113 项中 49 PASS、64 ERROR、0 assertion failure；全部 ERROR 来自两处历史生命周期 fixture 未按 V76 写入 `shared_folder.normalized_name`。经 GitNexus fixture 影响分析（MEDIUM 11 direct；LOW 2 direct）后仅补测试插入列，未改生产行为，随后重跑同一聚类。
- 首轮 L3 `/tmp/rem-p1-058-group-name-r1` 在首个合法 create 返回 500；无对象创建，manifest 和 active marker 均为零。真实日志定位为 PostgreSQL 无法推断可选 null `groupId` 参数类型；Mapper SQL 对该参数显式 cast 为 BIGINT 后复验。

## 2026-07-20：Mapper 绑定回归与 L2-L3 通过

- 新增真实 PostgreSQL + MyBatis Mapper 集成覆盖，证明 create 的 null `groupId` 和 update 的非空排除 ID 均可执行；L1 更新为 26/26 PASS，compile 与 diff check PASS。
- org/group 受影响聚类 114/114 PASS；Surefire XML 零 failure/error/skipped。退出后的 Flowable/Hikari shutdown-hook 警告不影响测试结果。
- backend-only 镜像重建为 `sha256:73fbb95a462ddde96ee28fa7c49f30fcce7b8092aab17f779fe546da086c7f42`，actuator `UP`，Flyway V78 成功，唯一索引存在，其余核心容器未替换。
- Playwright r2 已完整验证两次 400 产品响应，但旧 toast 与新 toast 同文案导致严格定位器歧义；限定最新 toast 后 r3 1/1 PASS（2.4s）。两轮均经产品归档清理，无 restore/purge，最终 manifest 与活动 marker 为零，backend 日志无 ERROR/5xx。
