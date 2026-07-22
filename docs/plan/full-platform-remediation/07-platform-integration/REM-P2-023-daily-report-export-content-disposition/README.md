# REM-P2-023：日报导出下载头

- 优先级：P2；领域：报表；状态：`CLOSED`
- 源：L4 `FQA_20260716_2300_lintfix`，`REPORT-002`。
- 问题：日报 XLSX 导出缺少 `Content-Disposition`，HTTP 客户端无法获得中文文件名。
- 范围：为既有导出响应设置 UTF-8 attachment 文件名；不改变导出数据、权限、范围或审计。
- 非目标：不调整报表内容或前端 fallback 文件名。
- 分支：`codex/rem-p2-023-daily-report-export-content-disposition`，基线：`lint-fix@e14cdc86`。
- 下一门禁：no-ff 合并后重跑 `REPORT-002` L4。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
