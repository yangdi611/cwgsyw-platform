# 覆盖汇总

| 范围 | 总数 | PASS | FAIL | BLOCKED | N/A | NOT_RUN |
|---|---:|---:|---:|---:|---:|---:|
| 主功能用例 | 275 | 0 | 1 | 0 | 0 | 274 |
| 状态/跨模块用例 | 78 | 0 | 0 | 0 | 0 | 78 |

本文件只汇总已在 `execution-record.md`、`evidence-index.md` 或逐项台账中有证据的结论。

浏览器执行通道已由独立 Playwright Chromium 恢复。`AUTH-001` 首次真实执行发现 `L4-DASHBOARD-001`，已分流至 `REM-P2-032`；合并后必须重新开始最终 L4，不能将事件级定向回归替代全量 PASS。
