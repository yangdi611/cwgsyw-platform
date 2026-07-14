# BLOCKED 用例解除计划

更新时间：2026-07-15
来源：`unique-case-ledger.md`、`state-cross-module-ledger.md`、`checkpoint.json`

## 定位

BLOCKED 不等于缺陷，也不能伪装成 PASS。本轮 52 个 BLOCKED 主用例及 45 个 BLOCKED 状态/跨模块项，主要来自授权窗口、外部系统、不可逆状态或产品缺少精确清理。下面按解除条件聚类；只有确认产品缺口时才转成新的 REM 事件。

| Gate | 覆盖用例 | 当前阻塞 | 依赖 / 解除条件 | 责任类型 |
|---|---|---|---|---|
| `BR-001` | `AUTH-007/010` | 真实 idle 超时需长等待或可逆配置 | 独占后端窗口；记录原 timeout；重启后复验并恢复 | 测试窗口 |
| `BR-002` | `AUTHZ-004..015`、`ST-AUTHZ-001..021`、`RBAC-027`、`WIKI-025` | 全租户 Legacy/Shadow/Enforced、migration、break-glass 会改变授权 | 用户明确批准；独占窗口；前置快照；回退演练；已关闭授权事件作为基线 | 高风险授权 |
| `BR-003` | `CMDB-034/039`、`XL-CMDB-005/008` | 缺可精确创建/清理的 Prometheus 告警和数值详情夹具 | 外部测试配置或产品级测试告警生命周期；不得污染真实告警 | 外部夹具 |
| `BR-004` | `OPS-006..010/016/017`、`ST-OPS-001..014` | 运维任务与 roster 无 delete/archive/purge | 完成产品生命周期事件后执行；若新增缺陷，单独建 REM | 产品生命周期 |
| `BR-005` | `DAILY-002/005..009`、`FLOW-002`、`CHANGE-008..013/019/020`、`ST-DAILY-001..004`、`ST-CHANGE-001..004`、`XL-EXPORT-002` | 日报/审批/通知/归档文件/流程终态无法精确回收 | `REM-P1-021/024/025/026/027` 完成；另行确认日报/变更终态 archive/purge 合同 | 跨模块生命周期 |
| `BR-006` | `WIKI-011/017`、`XL-WIKI-001` | 附件删除无法证明 SharedFile/MinIO 回收 | `REM-P1-021` 完成并证明 DB/MinIO/审计一致 | 存储生命周期 |
| `BR-007` | `AI-001..003` | provider 无安全 create/delete，API key 不可恢复 | 建立 provider 生命周期与 secret replacement/restore 合同；提供隔离测试 provider | 外部秘密 |
| `BR-008` | `NOTICE-003` 与通知 read lifecycle | mark-read/read-all 不可逆，缺 scoped 通知夹具 | 使用可删除 runId 通知或隔离账号；`REM-P1-005` 完成权限复验 | 测试数据 |
| `BR-009` | `FLOW-010`、`CHANGE-020` | binding 只有 GET/POST，覆盖租户现有 binding 且无法恢复 | 新建独立 Workflow binding lifecycle 事件或提供 unbind/disable/restore 产品合同 | 产品生命周期 |
| `BR-010` | `CONFIG-001..005`、`BACKUP-004` | 全局配置、外部发送、监控 token、restore 影响非测试环境 | 明确授权；值前后快照；隔离 SMTP/Prometheus；备份恢复独占环境 | 外部/全局变更 |

## 执行规则

1. 每次全量复验前重新生成 BLOCKED 清单；已解除项必须有产品级证据。
2. 任何需要直接 SQL、Redis、对象存储删除或修改非测试对象才能“清理”的用例继续 BLOCKED。
3. 由代码缺口造成的 gate 必须先建立独立 REM，不在测试线程临时修复。
4. 由用户授权或环境造成的 gate 不创建虚假代码缺陷；记录批准范围、开始/结束时间和恢复证据。
5. L4 关闭要求 BLOCKED=0；书面接受只适用于明确不执行的发布范围，不得改写为 PASS。
