# BLOCKED 用例解除计划

更新时间：2026-07-15
来源：`unique-case-ledger.md`、`state-cross-module-ledger.md`、`checkpoint.json`

## 定位

BLOCKED 不等于缺陷，也不能伪装成 PASS。本轮 52 个 BLOCKED 主用例及 45 个 BLOCKED 状态/跨模块项，主要来自授权窗口、外部系统、不可逆状态或产品缺少精确清理。下面按解除条件聚类；只有确认产品缺口时才转成新的 REM 事件。

## BR-011：REM-P1-013 临时用户组 purge 保留期（已解除）

- 对象：归档 runId 组 `REM_P1_013_GROUP_1784137960396_u`（id `26`）。
- 证据：所有 active/historical 引用为 0，purge preflight 唯一 blocker 为 `GROUP_PURGE_RETENTION_NOT_MET`，可清除时间 `2026-08-14T17:52:40.713814`。
- 解除证据：用户已授权仅隔离开发环境临时设置 `GROUP_LIFECYCLE_PURGE_RETENTION_DAYS=0`；产品 purge API 返回 200，随后恢复 `30`、重建 backend 健康，active/archived group 和用户 runId 查询均为 0。

| Gate | 覆盖用例 | 当前阻塞 | 依赖 / 解除条件 | 责任类型 |
|---|---|---|---|---|
| `BR-001` | `AUTH-007/010` | 真实 idle 超时需长等待或可逆配置 | 独占后端窗口；记录原 timeout；重启后复验并恢复 | 测试窗口 |
| `BR-002` | `AUTHZ-004..015`、`ST-AUTHZ-001..021`、`RBAC-027`、`WIKI-025` | 全租户 Legacy/Shadow/Enforced、migration、break-glass 会改变授权 | 用户明确批准；独占窗口；前置快照；回退演练；已关闭授权事件作为基线 | 高风险授权 |
| `BR-003` | `CMDB-034/039`、`XL-CMDB-005/008` | 内部 Prometheus mock、零告警同步和配置恢复已由 `REM-P2-017` 证明 | 在最终 L4 执行对应告警/数值详情用例并保持零残留 | 外部夹具 |
| `BR-004` | `OPS-006..010/016/017`、`ST-OPS-001..014` | 运维任务与 roster 无 delete/archive/purge | 完成产品生命周期事件后执行；若新增缺陷，单独建 REM | 产品生命周期 |
| `BR-005` | `DAILY-002/005..009`、`FLOW-002`、`CHANGE-008..013/019/020`、`ST-DAILY-001..004`、`ST-CHANGE-001..004`、`XL-EXPORT-002` | 日报/审批/通知/归档文件/流程终态无法精确回收 | `REM-P1-021/024/025/026/027` 完成；另行确认日报/变更终态 archive/purge 合同 | 跨模块生命周期 |
| `BR-012` | L4 `FQA_20260716_2300_lintfix` 日报审批 | 已审批日报只带历史 FQA 标记，既有清理仅接受完整 runId | 已解除：`REM-P1-031` 仅接受匹配时间戳的历史 FQA 标记；错误时间戳 400，匹配日报已 200 清理 | 日报测试生命周期 |
| `BR-006` | `WIKI-011/017`、`XL-WIKI-001` | 附件删除无法证明 SharedFile/MinIO 回收 | `REM-P1-021` 完成并证明 DB/MinIO/审计一致 | 存储生命周期 |
| `BR-007` | `AI-001..003` | 内部 OpenAI mock、test、显式清钥和 provider 恢复已由 `REM-P2-017` 证明 | 在最终 L4 执行 AI 用例并保持 provider 原始配置 | 外部秘密 |
| `BR-008` | `NOTICE-003` 与通知 read lifecycle | mark-read/read-all 不可逆，缺 scoped 通知夹具 | 使用可删除 runId 通知或隔离账号；`REM-P1-005` 完成权限复验 | 测试数据 |
| `BR-009` | `FLOW-010`、`CHANGE-020` | binding 只有 GET/POST，覆盖租户现有 binding 且无法恢复 | 新建独立 Workflow binding lifecycle 事件或提供 unbind/disable/restore 产品合同 | 产品生命周期 |
| `BR-010` | `CONFIG-001..005`、`BACKUP-004` | 已获授权；隔离 SMTP/Prometheus 配置快照、运行时验证和恢复已由 `REM-P2-017` 证明 | 在最终 L4 执行其余配置/备份独占复验并恢复快照 | 外部/全局变更 |
| `BR-071` | `CMDB-034`、`XL-CMDB-008` | Prometheus 告警此前缺少 runId 受限的产品清理入口；`REM-P1-071` 已完成 L1-L3 | no-ff 合并后在同 run 完成负责人确认、成员拒绝、实例导航、状态/审计读回及产品清理 0/0 | 产品生命周期 |

## 执行规则

1. 每次全量复验前重新生成 BLOCKED 清单；已解除项必须有产品级证据。
2. 任何需要直接 SQL、Redis、对象存储删除或修改非测试对象才能“清理”的用例继续 BLOCKED。
3. 由代码缺口造成的 gate 必须先建立独立 REM，不在测试线程临时修复。
4. 由用户授权或环境造成的 gate 不创建虚假代码缺陷；记录批准范围、开始/结束时间和恢复证据。
5. L4 关闭要求 BLOCKED=0；书面接受只适用于明确不执行的发布范围，不得改写为 PASS。
