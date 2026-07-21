# 实施记录

## 2026-07-21：发现、影响与实现

- 同 run `COMMON-012` 从 `/workflow/instances` 发现 `/daily/57`；详情返回 400，运行实例 `475a4859-...` 仍持有 `daily_report:57`。
- 失败证据提交在 L4 continuation `48c78eaa`；未修改或清理现存孤儿。
- 从 `lint-fix@4bd4ae56` 创建独立分支 `codex/rem-p1-067-daily-orphan-workflow-cleanup`。
- GitNexus upstream impact 为 MEDIUM：6 个直接调用者、单一 Daily 模块、无生产执行流扩散。
- 根因是受限清理只信任日报 `processInstId`；修复同时按精确 businessKey 查询 runtime/history，汇总去重后删除。

## 2026-07-21：L1-L3

- Java 21 `DailyReportRemediationCleanupTest` PASS。
- backend 生产镜像构建并替换当前容器成功。
- 专用 Playwright 创建日报 `102`、提交生成流程、调用受限清理后日报 400 且相同 businessKey 的 running/finished 均为空；1/1 PASS，1.1 秒。
- 新夹具产品 API 精确清理，`cleanupFailures=0`；未处理现存 `daily_report:57` 孤儿。
- 事件实现与 L1-L3 证据提交：`4a4c51b45cffc7830eb331cb0b1de45a4d134971`。
- `lint-fix` 顺序 no-ff 合并：`013ffec4496bc3a378f04b15caf83dba1d89ca22`。
