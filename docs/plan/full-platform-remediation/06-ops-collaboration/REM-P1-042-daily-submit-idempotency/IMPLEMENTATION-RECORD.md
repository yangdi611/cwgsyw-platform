# REM-P1-042 实施记录

## 2026-07-19：认领与实现

- 基线：`lint-fix@014a3e2d`；分支：`codex/rem-p1-042-daily-submit-idempotency`。
- 复现：同一 DRAFT 的两个并发 submit 均返回 200；产品 remediation 端点清理后 manifest 为零。
- GitNexus：`DailyReportService.submit` upstream 直接调用者 1、流程 0、Daily 单模块，风险 LOW。
- 根因：事务普通读取 DRAFT 后先启动流程、后更新状态，缺少串行化门禁。
- 实现：事务内 `SELECT ... FOR UPDATE` 锁定活跃日报，再执行原 owner/status/流程合同。

## 2026-07-19：L1-L3 复验

- Java 21：`DailyReportSubmitIdempotencyTest,DailyReportHistoricalGroupTest` 5/5 PASS；本机 Java 26 仅因 Byte Buddy 版本门禁失败。
- 构建：本机 backend compile PASS，Docker backend image build PASS。
- 运行时：仅替换 backend；健康为 `healthy`，frontend/PostgreSQL/Redis/MinIO/Nginx 容器 ID 均不变。
- 并发：两次 submit 恰好一个 200、一个 400，仅一个候选待办；审批双请求也仅一次成功，终态 APPROVED。
- 聚类：日报创建、边界、CI、提交/拒绝/重提/审批、scope 日历共 6/6 PASS。
- 清理：所有日报通过 remediation 产品端点清理；manifest `objects=[]`、`cleanupFailures=0`。
- 正式 `wiki_page -> remp1038wiki`、审批人 `superadmin` 策略未修改、未清理。
- 回滚：还原 mapper 锁定读取与 submit 调用点；无迁移、配置或 API 合同变化。
- 提交前 GitNexus `detect-changes`：4 个映射符号、3 条 Daily VO 流程，综合 MEDIUM；相邻 `toVO` 映射无实际代码变化，范围符合事件预期。
