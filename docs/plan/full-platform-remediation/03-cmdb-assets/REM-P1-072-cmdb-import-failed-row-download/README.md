# REM-P1-072：CMDB CSV 导入失败行下载

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-072` |
| 优先级 / 领域 | P1 / CMDB 导入导出 |
| 状态 | `CLOSED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `XL-EXPORT-004` |
| 分支 | `codex/rem-p1-072-cmdb-import-failed-row-download` |
| 基线 | `lint-fix@ea1a6531` |
| 事件运行 | `REM_P1_072_20260721` |
| 失败快照 | `d43e8637` |

执行完成后，CSV 导入失败行必须在有限 TTL 内仍可由同租户下载。失败结果与租户绑定，预览数据仍按原生命周期删除，下载内容包含原始失败行、行号和原因，并进行 CSV 特殊字符及公式注入防护。

L1-L3 已通过：Java 21 定向测试 5/5，backend package 与生产镜像构建成功，当前分支 backend healthy；最终 Playwright 1/1 在 `/tmp/rem-p1-072-xl-export-004-final3` 通过，manifest `objects=[]`、`cleanupFailures=0`，backend 无相关 ERROR/Exception。事件提交与顺序 no-ff 合并后，恢复同一 L4 run affected-only 重验。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
