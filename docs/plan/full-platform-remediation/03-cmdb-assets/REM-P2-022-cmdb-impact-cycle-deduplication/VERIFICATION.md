# REM-P2-022 验证矩阵

| AC | 用例 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | CMDB-031 | L1/L3 | PASS | 既有实例 #20 双向 depth 3：5 nodes/5 unique IDs |
| AC-002 | CMDB-031 | L1/L3 | PASS | 5 条边保持不变；循环节点不重复入层 |
| AC-003 | CMDB-031 | L3 | PASS | 当前分支 backend 容器 API 与 Playwright UI 零错误 |

定向 Maven 测试被既有 4 个无关 testCompile 错误阻断；主包 package 和运行时 L3 通过。合并后仍需独立 L4 重跑。
