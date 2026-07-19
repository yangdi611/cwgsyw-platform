# REM-P1-046：运维排班时间顺序校验

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-046` |
| 优先级 | P1 |
| 状态 | `VERIFIED` |
| 风险 | LOW |
| 来源 | `FQA_20260718_2050_remp1038` / `OPS-016` |
| 分支 | `codex/rem-p1-046-ops-roster-temporal-validation` |

`OPS-016` 在最新集成版本发现同日反向时间排班创建返回 `200`。本事件为 roster create/update 增加 `endAt` 严格晚于 `startAt` 的拒绝校验，并保持清理端点及其它排班合同不变。

L1-L3 已通过；下一门禁为 event commit、no-ff 合并并恢复同一 L4 run 重验 `OPS-016`。
