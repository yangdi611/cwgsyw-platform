# REM-P1-010：CMDB 影响分析与历史拓扑重建

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-010` |
| 优先级 | P1 |
| 领域 | `03-cmdb-assets` |
| 状态 | `NOT_STARTED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

影响分析 CTE 参数缺失后静默降级，时间点比较又无法从审计快照正确分类新增、修改、删除和未变节点。

用户看到空或错误的影响图与历史差异，无法用于变更评估和审计。

## 追溯

- 缺陷：`BUG-FQA-050`、`BUG-FQA-101`
- 用例：`CMDB-029`、`CMDB-030`、`CMDB-031`、`CMDB-032`
- 历史证据：`defects.md` 对应章节及 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

## 边界

根因：CTE 占位符绑定错误；拓扑逆放依赖的快照字段、关系标识和时间边界不一致。

范围：
- 修正 CTE 参数和超时/降级错误合同
- 定义可逆放的实例与关系审计快照
- 修复时间点边界与四类差异
- UI 图例与 API 计数一致

非目标：
- 不实现任意历史数据库快照
- 不改变拓扑深度定义
- 不将静默降级继续视为成功

下一门禁：逐符号 GitNexus upstream impact；`HIGH/CRITICAL` 告警后才可编辑。文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
