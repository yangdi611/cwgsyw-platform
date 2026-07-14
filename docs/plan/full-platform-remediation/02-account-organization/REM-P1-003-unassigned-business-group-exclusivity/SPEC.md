# REM-P1-003 实施合同

## 不变量与决策

历史合同要求未分配组与业务组 membership 不共存。当前产品合同更严格：`ActiveGroupReferenceValidator.lockAndRequire` 仅允许活动 `business` group 被业务引用，未分配组不能再经用户或 membership 写入入口建立关系。因此混合状态的起始条件不可达；不新增重复校验或自动迁组。

## 根因与影响

历史 `GroupMembershipService.add` 确有单向校验缺口，但前序 `REM-P1-001` 已将其调用的 `ActiveGroupReferenceValidator.lockAndRequire` 收紧为 business-only。该 validator 的影响为 CRITICAL（86 个符号、13 个模块），本事件不得改动它；运行时复验确认未分配组 API 输入返回 `409 GROUP_REFERENCE_INACTIVE`。

## 实施范围

| 符号 | 决策 |
|---|---|
| `ActiveGroupReferenceValidator` | 只读复验，当前 non-business 拒绝即为覆盖修复。 |
| `GroupMembershipService.add` | 不改动；调用上述 validator 后未分配组不可进入后续写入逻辑。 |

不改变 API 路径、成功响应、primary 排序、assignment 逻辑或 schema。

## 验收

| AC | 合同 |
|---|---|
| `AC-001` | validator 单元测试证明 non-business group 返回稳定 `409`。 |
| `AC-002` | 现有业务组 -> 未分配组 API 拒绝合同保持有效。 |
| `AC-003` | API 以 runId 用户尝试创建未分配组 membership，返回 `409 GROUP_REFERENCE_INACTIVE`，没有 membership。 |
| `AC-004` | 运行时 cleanup 核验活动 runId 用户/组均为 `0`；无生产 diff。 |
| `AC-005` | 最终 L4 全量 FQA 发布门禁，独立于事件关闭。 |

## 停止与回滚

若需要自动移除未分配组、修改存量混合数据或影响 assignment/session，停止并新建事件。回滚仅撤回本事件提交，无数据迁移。
