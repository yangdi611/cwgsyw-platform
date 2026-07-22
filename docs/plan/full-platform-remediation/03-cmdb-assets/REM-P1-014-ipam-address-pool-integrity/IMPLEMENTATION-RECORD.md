# REM-P1-014 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-041`、`BUG-FQA-064`、`BUG-FQA-072`、`BUG-FQA-073`、`BUG-FQA-075`；用例：`IPAM-003`、`IPAM-004`、`IPAM-006`、`IPAM-007`、`IPAM-009`、`COMMON-004`。
- 根因：归属模型、CIDR 区间不变量、释放记录复用和创建幂等均未在服务/数据库统一。
- GitNexus 已刷新并完成领域 query；未编辑业务符号，逐符号 impact 留给实施门禁。
- 未修改代码、数据库或容器，未创建测试对象。
- 下一步：独立分支认领后，从 `AC-001` 开始并追加实际 impact、diff、测试、证据、清理和回滚。

后续记录只追加，不覆盖历史。

## 2026-07-15：事件认领、授权决策与影响分析

- 分支：`codex/rem-p1-014-ipam-address-pool-integrity`，基线：`lint-fix@2b41bf8`。
- 已批准的高风险归属规则：管理员创建地址池必须选择业务归属组；组级用户创建时固定归属主组，不能指定其他组。
- 只读存量预检：活动 `ip_pool=0`，无需为非测试对象做归属回填或迁移裁决。
- GitNexus upstream impact：`IpPoolService` 的 list/detail/create/update/delete/allocate/release/utilization 及 CIDR helper 均只有一个直接 Controller 调用，风险 `LOW`；`IpPool` 3 个直接使用者、1 个创建流程；事件整体因授权收紧、地址分配和迁移仍为 `HIGH`。
- 已实施候选范围：`group_id` 归属、服务层范围裁决、IPv4 CIDR canonical/overlap、网关/DNS/可分配主机地址、released allocation 复用、组生命周期登记与前端管理员归属组选择。L1 定向单测和前端 typecheck 已通过，继续运行时复验。

## 2026-07-15：实现、复验与事件级结论

- 数据与生命周期：V74 为 `ip_pool` 增加 `group_id` 外键、活跃范围索引和活动业务组 trigger；组引用登记、迁移集成测试及 archive/purge fixture 同步纳入 `ipPools`，因此不能归档或清除仍拥有活动地址池的组。
- 范围裁决：所有 list/detail/utilization/create/update/delete/allocate/release/CI allocations 入口都携带 caller scope。组级用户只见本组，跨组直接访问返回明确业务拒绝；管理员/平台作用域可选组创建。
- 网络完整性：CIDR 规范为网络地址；同租户采用 transaction-scoped advisory lock 后检测任意重叠；gateway/DNS 与指定分配均需有效 IPv4、位于 CIDR 且在 /0-/30 时不是 network/broadcast；/31、/32 允许各自的 RFC 点到点/单地址分配。
- 生命周期：released 分配记录改为原位复用，保留唯一索引并避免重复 insert 500；重复 release 被明确拒绝；删除仍以 active allocation 为 `restrict` 保护。
- 前端：租户/平台管理员必须在新建弹窗选择归属组，组级用户不显示选择项且服务端固定本组；提交锁保持原有双击保护，服务端 overlap 排他覆盖后退/前进和网络重试。
- 复验：定向、组生命周期集成、全量后端、前端 typecheck/lint、Docker 当前分支 runtime 与 Playwright 通过。初次运行时发现 advisory-lock Mapper 以查询映射 `void` 引发 500，已改为 update 型执行并复验通过。
- 数据清理：三批 runId 均仅使用产品 API 创建；主池第一次删除被 active allocation `restrict` 正确拒绝，release 后删除成功；最终关键词查询均为 0。无 SQL、Redis、卷或全局会话操作。
- 回滚：回滚本事件提交与 V74 迁移即可恢复先前行为；当前本地无活动地址池，故不涉及非测试归属回填。事件状态：`VERIFIED`，等待最终 L4。
