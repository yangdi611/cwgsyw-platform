# REM-P1-011：CMDB 导航、模型路由与查询合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-011` |
| 优先级 | P1 |
| 领域 | `03-cmdb-assets` |
| 状态 | `CLOSED` |
| 风险 | `MEDIUM` |
| 负责人 | Codex |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

动态实例编辑按钮使用错误权限，中文 modelCode 被二次编码，rack 模型又未从目录和 2D 选择器暴露。

有权用户无法编辑/下载/发现资产能力，正常入口与后端能力断裂。

## 追溯

- 缺陷：`BUG-FQA-039`、`BUG-FQA-087`、`BUG-FQA-095`
- 用例：`CMDB-019`、`CMDB-022`、`CMDB-023`、`CMDB-037`、`XL-CMDB-009`
- 历史证据：`defects.md` 对应章节及 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

## 边界

根因：前端路由参数、permission action 与模型目录数据源没有统一契约。

范围：
- 对齐 cmdb_instance:update 门控
- modelCode 只编码一次并建立类型合同
- 补 rack 可见性和 2D/详情导航闭环

非目标：
- 不修改模型 CRUD 核心逻辑
- 不重新设计 CMDB 首页
- 不改变 rack U 位计算

结论：所有事件级 L1-L3 通过，等待最终 L4 全平台复验。文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
