# REM-P0-003：Shadow 创建判定观测

| 字段 | 内容 |
|---|---|
| 状态 | VERIFIED |
| 优先级 | P0 |
| 领域 | 安全与统一授权 |
| 分支 | `codex/rem-p0-003-shadow-create-observation` |
| 基线 | `lint-fix@148ebe16f` |
| 来源 | 最终 L4 `FQA_20260717_1245_final_l4` 严格预检 |

## 问题

Shadow 模式对资源读取/更新会写入兼容判定观测，但创建路径 `decideCreateWithCompatibility` 未写入观测。拥有既有 `wiki:create`、`shared_file:upload` 等授权的账号即使正常访问，也无法满足 strict preflight 的 Shadow coverage 要求，导致 Enforce 永久阻断。

## 范围

- 在 Shadow 模式为创建判定写入可审计的 `authorization_decision_diff` 观测。
- 保持 Legacy、Shadow、Enforced 的现有授权返回语义不变。
- 以 `resource_type=create`、无资源 ID 的稳定表示记录创建型权限。

## 非目标

- 不变更 ACL、role assignment、资源迁移、cutover、break-glass 或数据库 schema。
- 不修改既有非测试授权；L3 仅以 runId 测试对象经产品 API 创建并清理。

## 风险与下一门禁

授权核心路径按中等风险处理。GitNexus 对 `decideCreateWithCompatibility(BooleanSupplier)` 报告 LOW（图中无直接调用者），但静态调用点覆盖 Wiki 空间创建、共享目录创建/移动和根目录文件上传。

创建型 Shadow coverage 已从 5 降至 0，根目录上传/读取与产品 API 清理通过，Java 21 容器中的定向单测也已通过。本事件的 L1-L3 已完成，结算为 `VERIFIED`。严格预检仍有 6 条历史资源读/ACL 判定差异，属于独立根因；未修改任何既有 ACL、角色或 assignment，待用户确认后另建事件处理，且在该事件完成前不执行 Rollback/Enforce。

## 文件

- [SPEC.md](./SPEC.md)：实现合同。
- [VERIFICATION.md](./VERIFICATION.md)：L1-L4 验证矩阵。
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)：追加式执行记录。
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)：事件专用恢复入口。
