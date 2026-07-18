# REM-P1-042 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| 已提交锁定行在 workflow start 前拒绝 | L1 | PASS | Java 21 `DailyReportSubmitIdempotencyTest` |
| 两次并发提交恰好一次成功 | L2 | PASS | `test/l4-daily-ci-idempotency-current-run.spec.js` |
| 流程/待办唯一且状态 SUBMITTED | L2/L3 | PASS | 当前分支真实 API：一个 200、一个 400、一个待办；审批并发也仅一次成功 |
| 当前分支后端运行时与精确清理 | L3 | PASS | backend compile/build、仅替换 backend、健康；日报聚类 6/6，manifest 为空 |

本机 Java 26 因当前 Byte Buddy 仅支持到 Java 24 无法运行 Mockito；同一既有测试以相同环境原因失败。Java 21 容器中的新旧定向测试全部通过。
