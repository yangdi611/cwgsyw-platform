# REM-P1-023：Workflow BPMN 输入校验与设计往返完整性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-023` |
| 优先级 | P1 |
| 领域 | `05-workflow-change` |
| 状态 | `CLOSED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

流程 key/XML 无效输入返回 500，设计器保存后 name/category/description 与完整 BPMN 结构不能稳定重载，条件流命名空间又触发解析异常。

用户无法可靠保存、部署、重开和继续编辑流程设计。

## 追溯与边界

- 缺陷：`BUG-FQA-021`、`BUG-FQA-084`、`BUG-FQA-104`、`BUG-FQA-105`
- 用例：`WORKFLOW-DEFINITION-LIFECYCLE`、`FLOW-007`、`FLOW-008`、`FLOW-009`
- 根因：SaveProcessDefinitionReq 缺 validation；设计器初始 XML/序列化命名空间与 Flowable deployment 元数据映射未形成可往返合同。
- 原始证据：`defects.md` 与 `test-results/FQA_20260712_0329_lintfix/` 对应项；保持只读。

范围：
- key 与 XML preflight 校验并映射 4xx
- 补完整 BPMN 命名空间和最小开始/结束结构
- 统一 name/category/description/XML 保存回读
- 条件流、assignee、candidateGroups 往返测试

非目标：
- 不替换 Flowable
- 不迁移所有历史 BPMN
- 不改变流程权限

L1-L3 已通过：缺失 key 与非法 XML 已稳定返回 `400`；包含候选组与条件流的 BPMN 可创建、读取、更新至 v2 并保持关键结构，测试流程定义已经产品 API 删除。等待最终 L4。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
