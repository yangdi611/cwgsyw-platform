# REM-P1-006 实施合同

## 目标与不变量

目标：权限消费、兼容别名与导航可达性收敛，关闭 `BUG-FQA-010`、`BUG-FQA-013`、`BUG-FQA-035`、`BUG-FQA-069`、`BUG-FQA-070`、`BUG-FQA-074` 的共同根因。

运行时不变量：

- 既有成功路径、租户隔离、权限和路由语义不得意外放宽。
- 失败请求不得产生半写入、孤儿关系或敏感信息泄露。
- 原始 FQA 证据只追加修复映射，不覆盖历史结论。
- 所有新增测试数据使用 remediation runId，并通过产品接口精确清理。

## 当前与目标行为

当前：权限注册表、Controller guard、前端查询开关和父级导航采用了不同资源动作，导致无权请求、孤儿权限以及有权功能不可发现。

目标：最小权限账号可能看到错误入口、产生 403 噪音，或无法使用已被授予的能力。对应的用户风险消失，API、服务、数据、权限、审计、前端入口和错误状态使用同一合同。

## 已批准产品决策

2026-07-15，用户明确选择：**补齐权限**。本事件中已登记、可分配但尚无运行时 consumer 的权限必须补齐可审计、可授权、可撤销的产品能力；不得通过删除权限、隐藏权限或禁止分配来规避缺陷。新增能力仍须保持最小授权、既有资源边界和精确回滚。

## 合同

- API / UI：相关入口对相同输入和权限返回一致、可解释的结果。
- 服务 / 数据：权限 action/alias 没有统一运行时解析；导航父组按单一资源门控，页面初始化未按权限启用查询。
- 权限：不新增隐式放行；涉及 guard 时同时验证 allow、deny、直达路由和导航。
- 审计：写操作记录 operator、target 和必要快照，且不包含密码、token 或密钥。
- 兼容：保留现有 query key、成功响应结构和数据库合同，除非本事件明确修正该合同。
- 会话：本事件不得清空全体会话或改变 session 生命周期。

## 预计影响面

候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/security/**`、`backend/src/main/java/com/cwgsyw/platform/module/opscalendar/**`、`backend/src/main/java/com/cwgsyw/platform/module/cmdb/controller/CiModelController.java`、`frontend/src/components/layout/sidebar/**`、`frontend/src/hooks/usePermission.ts`

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
| `AC-001` | BUG-FQA-010 的原始失败路径按目标合同通过。 |
| `AC-002` | 其余缺陷 BUG-FQA-013、BUG-FQA-035、BUG-FQA-069、BUG-FQA-070、BUG-FQA-074 分别有独立 PASS 证据。 |
| `AC-003` | 正常、边界、无权限/不存在及失败无副作用矩阵通过。 |
| `AC-004` | 每个 action 的 allow/deny API 矩阵；单权限角色的首页导航与直达路由；页面加载零未解释 403；deprecated alias 与 canonical action 等价。 |
| `AC-005` | `detect_changes` 仅覆盖预期范围，测试数据清零，回滚可执行。 |
| `AC-006` | L4 发布候选版全量 FQA 通过；此前事件最多标记 `VERIFYING`。 |

## 回滚与停止条件

回滚以本事件独立提交为单位；如含 schema，必须先验证向后兼容和数据恢复。发现跨租户影响、不可逆数据变更、非测试对象修改、未解释 5xx 或影响超出上述范围时立即停止并标记 `BLOCKED`。
