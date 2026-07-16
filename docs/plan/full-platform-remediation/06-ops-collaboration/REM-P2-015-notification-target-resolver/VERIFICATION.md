# REM-P2-015 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | NOTICE-002 | L1 | backend compile；有效现有 Wiki 通知解析为 `/wiki/8/54` | `PASS` |
| `AC-002` | 通知归属 / 失效 / deny | L2 | 删除 Wiki、失效 ops task、随机 notification 统一 `available=false`；未认证 `403` | `PASS` |
| `AC-003` | 零副作用 | L2 | 解析前后 notification `isRead` 与 total 相同；未创建目标或审计写入 | `PASS` |
| `AC-004` | 五类目标 / UI | L3 | 当前分支 backend/frontend 容器；有效点击与失效中性页，Console=0、target endpoint failed request=0 | `PASS` |
| `AC-005` | impact/detect/cleanup | L3 | LOW/MEDIUM impact、detect_changes=LOW、无测试对象/清理失败 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 最终新 run | `PENDING` |

证据：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/REM_P2_015_20260716_190000/result.json`。五个 refType 由同一 resolver switch 覆盖；本运行的可用现有实例为 Wiki，最终 L4 将完整展开。
