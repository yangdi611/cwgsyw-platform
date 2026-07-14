# REM-P1-002 实施合同

## 目标与不变量

`sys_user_group_membership.is_deleted=true` 的记录不得出现在任何活动成员关系读模型中。主组标量字段只可作为已定义的 legacy 兼容来源，不能使已经删除的 membership 被重新解释为活动关系。

## 根因与决策

历史 `BUG-FQA-016` 记录的组成员读取问题来自 membership 查询语义。当前 `UserGroupMembershipMapper.findUserIdsByGroup` 已明确 `is_deleted=false`；本事件补齐 `GroupMembershipService.list` 的等价过滤，保护用户授权弹窗/用户维度成员列表。不得修改删除事务、assignment 撤销、权限计算或 schema。

## 修改范围

| 文件 / 符号 | 决策 |
|---|---|
| `backend/.../GroupMembershipService.java` / `list` | 增加 `isDeleted=false` 查询谓词。 |
| `backend/.../GroupMembershipServiceTest.java` | 捕获查询 wrapper，断言软删除谓词和值。 |
| `backend/.../UserGroupMembershipMapper.java` / `findUserIdsByGroup` | 只读复核，当前已有活动过滤，不重复修改。 |

GitNexus impact：`findUserIdsByGroup` 为 LOW，1 个直接调用者 `findUsersByGroup`，再到 `GroupController.getMembers`；无受影响 execution process。`list` 影响 `ListMemberships` 流程，需定向回归。

## 实施步骤

1. 保留所有工作区既有测试改动，在本事件分支只识别本事件生产 diff。
2. 在 `list` 增加活动 membership 过滤；禁止改变排序、tenant/user 条件或 VO 映射。
3. 增加最小单元回归，验证谓词含 `is_deleted` 且绑定 `false`。
4. 完成 L1-L3 验证并回写证据；通过后进入 `VERIFYING`，不替代 L4 全量复验。

## 回滚与停止

本变更无数据写入，回滚为撤回本事件提交。若发现 legacy 主组兼容规则与活动 membership 合同冲突、组成员 API 仍可复现、或受影响范围升为 HIGH/CRITICAL，停止并新建独立事件，不扩大本次修复。
