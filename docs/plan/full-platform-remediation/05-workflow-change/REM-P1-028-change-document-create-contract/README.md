# REM-P1-028：变更文档模板加载与创建响应合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-028` |
| 优先级 | P1 |
| 领域 | `05-workflow-change` |
| 状态 | `VERIFIED` |
| 风险 | `MEDIUM` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

新建页期待 fieldConfig 而列表返回 fields，并把创建响应对象整体当作数值 ID，导航到 [object Object]。

用户创建草稿后无法进入详情继续编辑，模板动态字段也未加载。

## 追溯与边界

- 缺陷：`BUG-FQA-059`、`BUG-FQA-102`
- 用例：`CHANGE-002`、`CHANGE-005`、`CHANGE-007`
- 根因：前后端 TypeScript/DTO 合同和创建响应类型被错误断言，缺少运行时 ID 校验。
- 原始证据：`defects.md` 与 `test-results/FQA_20260712_0329_lintfix/` 对应项；保持只读。

范围：
- 统一 TemplateVO 字段映射
- 定义 ChangeDocCreateResponse
- 使用 data.id 导航并处理缺失/非法 ID
- 回归单/双模板和详情回读

非目标：
- 不修改变更审批状态机
- 不改变模板生命周期
- 不清理非 runId 草稿

L1-L3 已通过：模板 `fields` 已正确加载，创建响应仅接受有效数值 ID 并导航到详情；单/双模板 API 与 UI 创建、详情回读和精确清理均通过。下一门禁：最终 L4 全平台 FQA。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
