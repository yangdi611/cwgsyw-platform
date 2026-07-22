# REM-P2-016 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| AC-001 | L1/L3 | PASS | `PUT` 200；`GET /admin/config` 读回 `false`、规范化 URL、`60` |
| AC-002 | L1/L3 | PASS | `ftp://...` 与 interval `9` 均 HTTP/body 400 |
| AC-003 | L3 | PASS | 匿名 `PUT` 为 403 |
| AC-004 | L3 | PASS | 当前事件分支 backend 重建、health `UP`；恢复原始空配置 |

## 检查

- `mvn -q -DskipTests compile`：PASS。
- `mvn -q -Dtest=SysConfigControllerTest test`：因既有 4 项其他模块 testCompile 错误阻断；本事件生产编译和容器构建均通过。
- L4 原始失败：真实 superadmin 对缺失 mapping 请求返回 HTTP 500，记录于 `FQA_20260716_191500_lintfix` Phase 9。

无测试对象创建；配置值已恢复，保留最小配置审计历史。

事件结论：`VERIFIED`，等待 no-ff 合并后重新执行 L4 受影响范围。
