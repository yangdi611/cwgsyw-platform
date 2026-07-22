# REM-P1-054 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| `AC-001` | L1-L2 | PASS | Java Controller 9/9、DTO validation 2/2；五类非法 API 请求均 400 且配置零部分写 |
| `AC-002` | L1-L3 | PASS | `/tmp/rem-p1-054-watermark-runtime-rerun`；真实 UI angle/文本/opacity/position 即时预览通过 |
| `AC-003` | L2-L3 | PASS | 配置保存刷新回读通过；`ExportServiceTest` 验证既有 PDF 消费读取 `watermark.angle` |
| `AC-004` | L3 | PASS | 配置恢复为原始值、manifest `objects=[]`、`cleanupFailures=0`、Console/5xx=0 |
| `AC-005` | L1-L3 | PASS | Java 14/14、frontend lint/typecheck/build、backend/frontend Docker build 与健康检查通过 |

原始失败：L4 snapshot `49e6717e`；`/tmp/l4-after-rem-p1-053-common-config`。失败不是 5xx，而是完整 catalog 合同不可执行：产品缺少 angle 和即时预览。修复后证据见 `/tmp/rem-p1-054-watermark-runtime-rerun`。
