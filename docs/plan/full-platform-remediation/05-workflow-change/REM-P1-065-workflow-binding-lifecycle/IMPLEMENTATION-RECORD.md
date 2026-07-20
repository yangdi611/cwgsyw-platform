# 实施记录

## 2026-07-21：认领与风险门禁

- 从 `lint-fix@02270f10` 创建独立分支 `codex/rem-p1-065-workflow-binding-lifecycle`。
- 来源 L4 continuation `6eb1abda`；失败快照提交 `9dc80cd0` 位于 continuation 分支，不属于事件实现提交。
- 只读运行时探测证明页面/API 只有创建/覆盖，现有 daily/wiki 正式 binding 前后不变，manifest 0/0。
- 历史 `BR-009` 已明确将 `FLOW-010/CHANGE-020` 标记为产品生命周期缺口：需要审计化 unbind/delete/disable 或可精确恢复的版本化 lifecycle。

## GitNexus upstream impact

- `WorkflowCenterController`：LOW，0 直接依赖，0 流程。
- `WorkflowBindingsPage`：LOW，0 直接依赖，0 流程。
- `ProcessBindingService`：MEDIUM，6 个直接依赖。
- 既有 `bind`：HIGH，3 个直接调用者、3 个模块，影响模板实例 `createInstance` 流程。
- `getActiveBinding`：HIGH，3 个直接调用者，间接影响 Daily/Wiki/Adapter。
- `WorkflowProcessBinding`：CRITICAL，7 个直接依赖、5 个模块，影响模板创建流程。
- `WorkflowProcessBindingMapper`：LOW，2 个直接依赖。

因此不修改既有 `bind` 语义，不在用户决定前修改实体、runtime fallback 或业务启动行为。建议通过新增生命周期方法最小扩展，并对模板创建、日报/Wiki runtime、定义删除保护和 UI 做完整回归。

## 待决边界

停用/删除后是拒绝新启动、回退 legacy 配置还是允许无审批继续，以及是否采用软删除，都会改变跨模块产品语义。已暂停请求用户确认建议合同。

## 2026-07-21：用户授权

- 用户明确授权：绑定软删除；停用/删除后禁止新流程启动且不回退旧配置；已有实例继续运行；重新启用重新校验；全部操作写审计。
- 实施解释：从未存在统一 binding 历史的业务类型仍可使用 legacy 键兼容；活动/停用/已删除记录任一存在后，统一 binding 成为唯一来源，避免显式停用/删除被旧键绕过。

## 2026-07-21：实现与 L1-L3 收敛

- V79 为 binding 增加逻辑删除、删除时间/操作人，活动记录使用部分唯一索引；实体启用 MyBatis-Plus `@TableLogic`，history count 明确包含墓碑。
- 新增 enable/disable/delete 服务与 Controller 入口；重启用重新校验定义存在、未挂起及模板业务类型，停用/删除清空 legacy 兼容键，所有操作写 workflow audit。
- `getActiveBinding` 只在从未存在统一 binding 历史时读取 legacy 键；存在活动、停用或墓碑后不再回退。新流程无活动 binding 时稳定拒绝，既有实例不迁移、不终止。
- 前端 binding 页面增加编辑、启停与删除确认/取消；编辑锁定业务类型并允许选择指定定义版本。
- Java 21 定向 18/18、Workflow/Daily/Wiki 聚类 167/167、frontend typecheck/目标页 lint、backend/frontend 生产构建与 `git diff --check` 通过。
- 当前事件分支镜像只替换 backend/frontend；backend/Postgres healthy，前后端 HTTP 200，Flyway 从 V78 成功迁移至 V79。
- 最终 Playwright `/tmp/rem-p1-065-playwright-final` 1/1 PASS：自定义 businessType 的 v1 创建、v2 编辑、停用、挂起定义重启用拒绝、恢复启用、删除确认/取消、重复删除、墓碑后重建、权限拒绝、审计均通过，Console/5xx 为 0。
- 真实 v1 运行实例在 binding 切换 v2、停用和删除后仍可从 running API 读取，随后通过产品实例删除 API 精确终止；定义、binding、账号、assignment 和 role 均通过产品 API 逆序清理。
- 最终 manifest 为 `objects=[]`、`cleanupFailures=0`；活动 runId binding/定义/实例/用户/角色为 0。只读数据库核对证明软删墓碑保留 `deleted_at/deleted_by`。
- 未修改 daily/wiki/change/device 正式 binding，未直接 SQL 写入，未 restore、purge、清 Redis/会话、操作外部系统或执行 push。
- 事件实现与 L1-L3 证据提交：`7f43a36dc1cfe1de65f956e191742a1eee6b3c87`；提交前 GitNexus staged 审计为 MEDIUM，26 个已索引符号、3 条预期流程，无意外范围。
- 事件分支证据头：`67404ccd5800d16783ecbe06bcf9c37c44cc1839`；`lint-fix@02270f10` 的 no-ff 合并已无冲突进入待提交状态，下一步生成 merge commit 并证明祖先关系。
