# REM-P1-012：设备、凭据与范围合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-012` |
| 优先级 | P1 |
| 领域 | `03-cmdb-assets` |
| 状态 | `NOT_STARTED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

设备详情绕过 group scope，长中文输入触发 500，凭据缺编辑 API/UI 且复制没有可靠反馈。

低权用户可能读取跨组设备，管理员也无法安全轮换凭据或理解复制结果。

## 追溯

- 缺陷：`BUG-FQA-018`、`BUG-FQA-080`、`BUG-FQA-092`、`BUG-FQA-103`
- 用例：`DEVICE-005`、`DEVICE-007`、`DEVICE-009`、`DEVICE-010`
- 历史证据：`defects.md` 对应章节及 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

## 边界

根因：列表和详情范围裁决分叉；DTO 与数据库长度不一致；CredentialRow/Controller 生命周期不完整。

范围：
- 统一列表/详情 group scope
- 补设备字段长度校验
- 实现凭据编辑、掩码、审计和复制反馈
- 将不支持方法稳定映射为 404/405

非目标：
- 不输出或持久化明文密码证据
- 不改变凭据加密算法
- 不扩大 device 权限

下一门禁：逐符号 GitNexus upstream impact；`HIGH/CRITICAL` 告警后才可编辑。文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
