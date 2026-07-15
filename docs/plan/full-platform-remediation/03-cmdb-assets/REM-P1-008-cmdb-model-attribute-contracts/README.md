# REM-P1-008：CMDB 模型与动态属性合同收敛

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-008` |
| 优先级 | P1 |
| 领域 | `03-cmdb-assets` |
| 状态 | `VERIFIED` |
| 风险 | `HIGH` |
| 负责人 | Codex |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

模型更新未触发颜色校验，动态属性 fieldKey 缺长度和同模型唯一约束，更新后 defaultValue 又无法稳定回读。

管理员可能得到 500、创建重复元数据，或无法确认动态表单默认值。

## 追溯

- 缺陷：`BUG-FQA-047`、`BUG-FQA-079`、`BUG-FQA-090`、`BUG-FQA-091`
- 用例：`CMDB-005`、`CMDB-006`、`CMDB-008`、`CMDB-009`、`CMDB-010`、`CMDB-011`、`CMDB-017`
- 历史证据：`defects.md` 对应章节及 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

## 边界

根因：Controller @Valid、DTO/schema 边界、唯一索引和 entity/VO 映射没有形成闭环。

范围：
- 统一模型/属性 DTO 与数据库边界
- 补同模型 fieldKey 服务预检和并发唯一约束
- 修复 defaultValue 保存与回读
- 前端字段提示与最大长度同步

非目标：
- 不重设计全部属性类型
- 不自动合并存量重复字段
- 不改变实例 fieldsData schema

下一门禁：等待最终 L4 全平台复验。L1-L3 已通过，测试对象已精确清理。文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
