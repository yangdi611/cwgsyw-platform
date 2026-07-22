# REM-P2-014：周期规则删除与确认入口

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-014` |
| 优先级 | P2 |
| 领域 | `06-ops-collaboration` |
| 状态 | `CLOSED` |
| 风险 | `LOW` |
| 负责人 | Codex |
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

## 2026-07-16 L1-L3 结论

- GitNexus upstream impact：`OpsCalendarRulesPage` 直接调用者 0、受影响流程 0，风险 `LOW`；现有 Controller delete 亦为 `LOW`、无直接调用者，Service delete 仅有 Controller 一个直接调用者。只改前端页面。
- 管理员在真实页面可见删除按钮；取消后规则仍在，确认后调用既有 DELETE、显示“规则已删除”并刷新列表。浏览器 Console error 与 failed request 均为 0。
- 未认证 DELETE 为 `403`；删除后读取与重复删除均稳定为 `400`“规则不存在”；只读审计核验确认 `ops_calendar/delete/ops_schedule_rule` 记录。
- 唯一 runId 停用规则经产品 UI DELETE 清理，最终活动对象 0、清理失败 0；无权限、角色、会话或非测试业务对象变更。

下一门禁：提交事件证据并按 `--no-ff` 合并到 `lint-fix`，随后创建独立 L4 全平台复验分支。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
