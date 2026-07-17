# 证据索引

| ID | 结论 | 证据 |
|---|---|---|
| L4-PHASE0-001 | PASS | `environment-baseline.md`；backend health `UP` |
| L4-B1-RUNTIME-001 | BLOCKED | `execution-record.md`；内置浏览器及 Chrome extension 连接失败诊断；未替代为 API 验证 |
| AUTH-001 首次 | FAIL | `defects.md`；登录后首页 page error `_.filter is not a function`，已分流 `REM-P2-032` |
| REM-P2-032 L3 | PASS | `test-results/FQA_20260717_1125_final_l4/REM-P2-032/result.json`；当前事件分支生产容器中真实登录-首页-登出回跳，零错误 |
