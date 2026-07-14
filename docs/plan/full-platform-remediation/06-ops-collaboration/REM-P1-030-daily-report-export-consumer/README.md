# REM-P1-030：日报导出权限运行时消费者

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-030` |
| 优先级 | P1 |
| 领域 | `06-ops-collaboration` |
| 状态 | `NOT_STARTED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

daily_report:export 可分配，但日报 Controller 和页面没有导出 endpoint 或控件。

用户获得无效果权限，授权矩阵与产品能力脱节。

## 追溯与边界

- 缺陷：`BUG-FQA-094`
- 用例：`DAILY-008`
- 根因：permission registry/角色模板先于日报导出能力发布。
- 原始证据：`defects.md` 与 `test-results/FQA_20260712_0329_lintfix/` 对应项；保持只读。

范围：
- 决定实现或下架 export action
- 若实现，提供日期范围下载 API/UI
- 应用数据范围、文件合同与审计
- 同步 permission consumer 分类

非目标：
- 不复用语义不同的综合报表冒充日报导出
- 不扩大日报 read 权限
- 不改变审批流程

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
