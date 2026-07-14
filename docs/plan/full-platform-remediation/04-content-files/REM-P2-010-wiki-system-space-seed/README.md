# REM-P2-010：Wiki 系统手册与只读空间种子

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-010` |
| 优先级 | P2 |
| 领域 | `04-content-files` |
| 状态 | `NOT_STARTED` |
| 风险 | `MEDIUM` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

前后端支持 system/readOnly/writeScope 分层，但运行数据没有系统手册空间。

用户无法访问预期系统帮助，已实现只读分层无法验收。

## 追溯与边界

- 缺陷：`BUG-FQA-078`
- 用例：`WIKI-001`
- 根因：seed migration/初始化任务未创建或升级存量环境中的系统空间。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- 建立幂等系统空间 seed
- 支持存量环境补数与版本标记
- 验证只读保护和个人排序不受影响

非目标：
- 不在代码中硬编码完整手册正文
- 不覆盖用户自建同名空间
- 不改变团队/个人空间语义

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
