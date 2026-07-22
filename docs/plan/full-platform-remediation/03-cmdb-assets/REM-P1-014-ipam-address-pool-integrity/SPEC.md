# REM-P1-014 实施合同

## 目标与不变量

关闭 `BUG-FQA-041`、`BUG-FQA-064`、`BUG-FQA-072`、`BUG-FQA-073`、`BUG-FQA-075` 的共同根因：IPAM 地址池、分配与范围完整性。

- 保持租户和 group scope 隔离；不放宽既有权限。
- 失败必须原子且可解释，不产生孤儿、重复或半写入。
- 原始 FQA 证据不覆盖；新测试对象带 remediation runId 并精确清理。
- schema 改动须有存量冲突预检、向后兼容与回滚说明。

## 当前与目标

当前：地址池无 group scope，接受非法网关/DNS、重复/重叠 CIDR，允许网络/广播地址分配，released 记录再分配还会触发唯一键 500。

目标：跨组信息泄露、地址冲突和错误分配会破坏 IPAM 可信度，重复提交产生重复池。对应的风险消失；API、服务、数据库、UI、权限和审计遵循同一合同。

## 合同与影响面

- 根因合同：归属模型、CIDR 区间不变量、释放记录复用和创建幂等均未在服务/数据库统一。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/ipam/**`、`frontend/src/app/(dashboard)/ipam/**`、`backend/src/main/resources/db/migration/**`
- 权限：allow/deny、列表/详情、直达路由与导航一致。
- 数据：必要唯一/检查/引用约束必须有服务层可理解错误和并发测试。
- 审计：记录 operator/target/必要快照，不包含密码、token、密钥或文件正文。
- 兼容：保留既有成功响应、query key 和路由，除非本事件明确修正。
- GitNexus：规划时索引已刷新；实施前必须对每个拟编辑符号执行 upstream `impact`。

## 实施步骤

1. 逐缺陷复现或只读确认，冻结数据与错误合同。
2. 如需 schema，先扫描存量冲突并设计可回退迁移。
3. 以最小根因改动实施，并为每个缺陷保留独立断言。
4. 执行 L1 定向、L2 聚类、L3 模块回归及 `detect_changes`。
5. 产品 API 逆序清理，记录证据与回滚结果。

## 验收

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-041 原始路径通过。 |
| `AC-002` | BUG-FQA-064、BUG-FQA-072、BUG-FQA-073、BUG-FQA-075 分别有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发及失败零副作用通过。 |
| `AC-004` | 跨组 list/detail/utilization deny；CIDR canonical/overlap/并发；network/broadcast 与 /31-/32；release→auto/manual reuse；后退/双击重提交。 |
| `AC-005` | `detect_changes`、清理、schema/回滚验证完整。 |
| `AC-006` | 发布候选版 L4 全量 FQA 通过。 |

## 停止与回滚

影响超出候选范围、发现非测试数据需变更、存量冲突无法自动裁决、出现未解释 5xx 或回滚不可验证时停止并标记 `BLOCKED`。回滚以独立提交和配套迁移为单位。
