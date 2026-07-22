# REM-P2-023 验证矩阵

| AC | 用例 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | REPORT-002 | L1/L3 | PASS | 真实响应含 `filename*` UTF-8 中文名 |
| AC-002 | REPORT-002 | L1/L3 | PASS | XLSX MIME、`504b0304` ZIP 签名与非空字节 |
| AC-003 | REPORT-002 | L3 | PASS | 当前分支容器 Playwright 下载名正确，零错误 |

定向 Maven 测试受既有无关 testCompile 错误阻断；主包构建和运行时 L3 通过。合并后仍需独立 L4 重跑。
