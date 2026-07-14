# REM-P1-007 实施合同

## 目标与不变量

目标：已删除角色关联读取与清理一致性，关闭 `BUG-FQA-055`、`BUG-FQA-093` 的共同根因。

运行时不变量：

- 既有成功路径、租户隔离、权限和路由语义不得意外放宽。
- 失败请求不得产生半写入、孤儿关系或敏感信息泄露。
- 原始 FQA 证据只追加修复映射，不覆盖历史结论。
- 所有新增测试数据使用 remediation runId，并通过产品接口精确清理。

## 当前与目标行为

当前：角色软删除后，permissions 关联接口仍按 roleId 直接读取关系，泄露已删除对象的授权集合。

目标：管理端无法判断角色是否真正删除，孤儿关系可能继续影响缓存、审计或兼容授权计算。对应的用户风险消失，API、服务、数据、权限、审计、前端入口和错误状态使用同一合同。

## 合同

- API / UI：相关入口对相同输入和权限返回一致、可解释的结果。
- 服务 / 数据：RoleController/RbacService 的关联读取缺少租户、存在性和软删除校验；删除事务未形成明确的关系收敛合同。
- 权限：不新增隐式放行；涉及 guard 时同时验证 allow、deny、直达路由和导航。
- 审计：写操作记录 operator、target 和必要快照，且不包含密码、token 或密钥。
- 兼容：保留现有 query key、成功响应结构和数据库合同，除非本事件明确修正该合同。
- 会话：本事件不得清空全体会话或改变 session 生命周期。

## 预计影响面

候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/rbac/RoleController.java`、`backend/src/main/java/com/cwgsyw/platform/module/rbac/RbacService.java`、`backend/src/main/java/com/cwgsyw/platform/module/wiki/WikiSpaceService.java`

GitNexus 索引已于 2026-07-15 刷新到规划基线；这里仅是候选范围。实施者必须在编辑每个函数、类或方法前运行 upstream `impact`，把 direct callers、processes、modules 和风险写入实施记录。

## 实施步骤

1. 用原始证据和当前代码复现或只读确认每个缺陷。
2. 固定共享合同，并为每个缺陷保留独立测试断言。
3. 按最小根因改动实施，不混入格式化、依赖升级或无关重构。
4. 先跑定向测试，再跑根因聚类与模块回归。
5. 运行 `detect_changes`，记录证据、清理和回滚结果。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-055 的原始失败路径按目标合同通过。 |
| `AC-002` | 其余缺陷 BUG-FQA-093 分别有独立 PASS 证据。 |
| `AC-003` | 正常、边界、无权限/不存在及失败无副作用矩阵通过。 |
| `AC-004` | 角色创建编辑删除完整链路；删除后详情/permissions/assign 读取拒绝；有引用角色删除保护；跨租户 roleId 不泄露。 |
| `AC-005` | `detect_changes` 仅覆盖预期范围，测试数据清零，回滚可执行。 |
| `AC-006` | L4 发布候选版全量 FQA 通过；此前事件最多标记 `VERIFYING`。 |

## 回滚与停止条件

回滚以本事件独立提交为单位；如含 schema，必须先验证向后兼容和数据恢复。发现跨租户影响、不可逆数据变更、非测试对象修改、未解释 5xx 或影响超出上述范围时立即停止并标记 `BLOCKED`。
