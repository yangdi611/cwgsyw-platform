# REM-P1-041：文件夹对话框草稿重置

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-041` |
| 优先级 | P1 |
| 状态 | `CLOSED` |
| 风险 | LOW |
| 来源 | `FQA_20260718_2050_remp1038` / `COMMON-009` |

真实“新建文件夹”对话框经 Escape 关闭后重新打开仍保留未提交名称。事件统一关闭路径的本地表单重置，不改变 API、权限、路由或数据合同。

L1-L3 已通过：ESC、遮罩、X、取消均清空名称和归属组，关闭过程零创建请求；成功创建、列表回读、产品 API 删除及 runId 零残留回归通过。下一门禁为独立提交、no-ff 合并后重验 L4 `COMMON-009`。

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
