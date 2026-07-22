# REM-P1-020：共享文件夹重命名、移动与名称合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-020` |
| 优先级 | P1 |
| 领域 | `04-content-files` |
| 状态 | `CLOSED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

文件夹只有创建/删除，缺少重命名和移动；名称又未 trim、限长、限制分隔符或同级唯一。

用户无法维护目录结构，非法或超长名称会触发 500。

## 追溯与边界

- 缺陷：`BUG-FQA-062`、`BUG-FQA-063`
- 用例：`FILE-002`、`FILE-003`
- 根因：Folder DTO/Controller/Service 生命周期不完整，树结构不变量与名称规范没有服务/数据库兜底。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- 实现 rename/move API 与 UI
- 校验目标 parent 权限、防环和根目录规则
- 统一名称规范和同级唯一
- 审计并刷新树

非目标：
- 不移动文件本体内容
- 不批量重构历史目录
- 不改变 ACL 继承规则

L1-L3 已通过：重命名、移动、名称约束、防环、权限边界和树刷新均已完成 API/UI 复验；等待最终 L4。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
