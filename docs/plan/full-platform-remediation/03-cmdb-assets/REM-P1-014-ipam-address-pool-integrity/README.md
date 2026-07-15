# REM-P1-014：IPAM 地址池、分配与范围完整性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-014` |
| 优先级 | P1 |
| 领域 | `03-cmdb-assets` |
| 状态 | `VERIFIED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

地址池无 group scope，接受非法网关/DNS、重复/重叠 CIDR，允许网络/广播地址分配，released 记录再分配还会触发唯一键 500。

跨组信息泄露、地址冲突和错误分配会破坏 IPAM 可信度，重复提交产生重复池。

## 追溯

- 缺陷：`BUG-FQA-041`、`BUG-FQA-064`、`BUG-FQA-072`、`BUG-FQA-073`、`BUG-FQA-075`
- 用例：`IPAM-003`、`IPAM-004`、`IPAM-006`、`IPAM-007`、`IPAM-009`、`COMMON-004`
- 历史证据：`defects.md` 对应章节及 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

## 边界

根因：归属模型、CIDR 区间不变量、释放记录复用和创建幂等均未在服务/数据库统一。

范围：
- 建立地址池 group ownership 与范围裁决
- 规范化 CIDR 并检测重复/重叠
- 验证 gateway/DNS/host 地址
- 复用 released allocation
- 服务端冲突与前端提交幂等

非目标：
- 不自动重分配现有地址
- 不直接修复存量冲突而无迁移报告
- 不改变 IPv6 支持范围

结论：L1-L3 已通过。管理员必须选择业务归属组，组级用户固定本组；跨组列表、详情、利用率与写操作均拒绝且无泄露。CIDR 已规范化并串行化检查重叠，网关/DNS 与可分配地址遵循 IPv4 主机范围，released 地址复用不再触发 500。所有 runId 夹具已经产品 API 逆序清理。等待独立 L4 全平台复验后才可 `CLOSED`。文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
