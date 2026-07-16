# REM-P1-030：日报导出权限运行时消费者

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-030` |
| 优先级 | P1 |
| 领域 | `06-ops-collaboration` |
| 状态 | `VERIFIED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

现有 `/api/reports/export` 与 `/reports` 已消费该权限，但组级用户可借 `groupId` 越权导出同租户其他组的已审批日报，且侧栏入口未按该权限隐藏。

已确认的范围合同将以服务端强制范围、导出审计和前端导航守卫闭环。

## 追溯与边界

- 缺陷：`BUG-FQA-094`
- 用例：`DAILY-008`
- 根因：导出消费者未在运行时将 group scope 收敛为当前用户所属组，导航遗漏 permission consumer。
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

结论：L1-L3 已通过，等待最终 L4 全平台复验；代码与台账将按单事件分支提交并 `--no-ff` 合并到 `lint-fix`。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
