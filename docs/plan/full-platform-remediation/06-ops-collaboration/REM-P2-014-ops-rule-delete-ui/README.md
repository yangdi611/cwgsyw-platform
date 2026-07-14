# REM-P2-014：周期规则删除与确认入口

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-014` |
| 优先级 | P2 |
| 领域 | `06-ops-collaboration` |
| 状态 | `NOT_STARTED` |
| 风险 | `LOW` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

后端支持删除周期规则，管理页面却只有编辑和启停。

管理员无法从产品 UI 完成规则清理，测试 fixture 也无法闭环。

## 追溯与边界

- 缺陷：`BUG-FQA-097`
- 用例：`OPS-020`
- 根因：前端 action 列未消费现有 DELETE endpoint。
- 原始证据：`defects.md` 与 `test-results/FQA_20260712_0329_lintfix/` 对应项；保持只读。

范围：
- 增加 manage 权限删除按钮
- 确认/取消与成功刷新
- 受引用/删除失败提示
- 核对审计

非目标：
- 不修改删除 API 语义
- 不批量删除规则
- 不改变启停流程

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
