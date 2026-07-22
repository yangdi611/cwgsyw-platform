# REM-P1-012：设备、凭据与范围合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-012` |
| 优先级 | P1 |
| 领域 | `03-cmdb-assets` |
| 状态 | `CLOSED` |
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

结论：L1-L3 已通过。组级账号无法枚举、读取或写入其他组设备；设备与凭据输入在边界处返回校验错误；凭据可安全编辑、刷新后保持掩码，复制反馈可见且浏览器端 RSA-OAEP 解密与后端参数一致。两批 runId 夹具均已通过产品 API 精确清理。等待独立 L4 全平台复验后才可 `CLOSED`。文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
