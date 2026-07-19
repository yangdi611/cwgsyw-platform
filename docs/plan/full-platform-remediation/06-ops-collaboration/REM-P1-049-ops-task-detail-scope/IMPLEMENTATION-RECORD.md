# REM-P1-049 实施记录

## 2026-07-19：认领、根因与实现

- 分支 `codex/rem-p1-049-ops-task-detail-scope`，基线 `lint-fix@aa17a6f6`，事件 runId `REM_P1_049_20260719`。
- L4 失败快照 `c4a782ed`：member3 的 mine 列表排除 group2 sensitive/group 任务，但 direct detail 返回 200；全部任务、assignment、用户和角色已产品 API 清理。
- GitNexus 初始结论：`detail` LOW（1 direct/3 total/0 flow）；既有 `canViewDetail` HIGH（3 direct/10 total/0 flow），因此不修改该共享方法。
- 根因：`canViewDetail=false` 只触发 sensitive 字段遮罩，`detail` 从不拒绝列表范围外任务。
- 实现：新增独立 `canAccessDetail`，在构造详情前执行非枚举拒绝；不修改 `canViewDetail`、列表 scope 或操作权限。
- 刷新 GitNexus 索引后复核：`detail` MEDIUM（1 个生产 Controller + 5 个测试 direct，间接通知 resolver）；`canAccessDetail` HIGH（1 个生产 + 8 个测试 direct，0 flow）。HIGH 主要由定向测试引用数触发，但仍按授权高风险门禁验证。
- L1：Java 21 29/29 PASS，包括可见性、任务详情早拒绝/脱敏/完整响应，以及通知 resolver allow/unavailable 回归。
- 数据安全决定：`notification_message` 没有按任务清理的产品接口，事件运行时不额外制造通知；resolver 用纯单元测试，API/UI 矩阵只创建可由现有 remediation task purge、assignment/user/role DELETE 精确收敛的数据。

## 2026-07-19：L2-L3 通过

- 当前分支生产 backend build PASS，仅替换 backend 后 Docker healthy、actuator/gateway UP。
- 证据审计补跑两次发现测试夹具问题：空邮箱被 account setup 400 拒绝；脱敏字段按 Jackson 合同省略而非输出 null。两次均完成 finally 清理且未用于 PASS，随后修正测试资产。
- 事件专属 Playwright R3 1/1 PASS：跨组 direct-id 稳定 400 且“不存在”语义一致；public 脱敏、creator、跨组 participant、own-group read_group、tenant/read_all 正向详情通过；真实 UI 不泄露拒绝任务标题/正文及 public 正文，无 page error/5xx。输出 `/tmp/rem-p1-049-runtime-audit-r3`。
- 完整聚类的后续 `OPS-007` 候选 UI 超时与本事件无关，未用于提升聚合 case；其 finally 清理为零。
- 事件 manifest、runId 用户/角色/任务和 cleanup failure 均为 0，backend 无 ERROR/Exception。状态保持 `VERIFIED`，待 detect、提交和 no-ff 合并。

## 2026-07-19：最终分支复验

- 最终 backend 镜像 manifest list `74d3b0beb01fd28ff35430116ee687faf2bc07c3b2fa493e3127d0cf5f25b1e0`，容器 `healthy`。
- 事件资产将动态对象 runId 与固定 manifest 所有者 `REM_P1_049_20260719` 分离；GitNexus 尚未索引该 ignored 新文件中的 `writeManifest`，影响查询返回 `UNKNOWN`、0 impacted，实际调用范围仅限本 spec。
- Playwright `/tmp/rem-p1-049-runtime-final-r2` 1/1 PASS（10.0 秒）；事件 manifest 为空、`cleanupFailures=0`，最新 backend 日志窗口无 `ERROR/Exception`。
