# REM-P0-003 验证矩阵

| AC | 层级 | 验证 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | L1 | `AuthorizationServiceTest` Shadow 创建观测 | PASS | Java 21 容器：`mvn -q -Dtest=AuthorizationServiceTest test` 通过 |
| AC-002 | L1 | Legacy/Enforced 无观测与返回值回归 | PASS | 同一 Java 21 定向测试通过，覆盖 Legacy/Enforced 不写观测 |
| AC-003 | L2 | Wiki/共享目录/文件创建 API 合同 | PASS | 当前分支 Shadow 后端；空间创建 200，根目录上传 200，资源读取 200 |
| AC-004 | L3 | 当前分支容器、byron Shadow 会话、strict preflight | PASS | `unobservedPermissionGrants: 5 -> 0`；6 条历史读/ACL decision diff 与创建观测遗漏为独立根因，保留给待批准的新 REM，未进行 Rollback/Enforce |
| AC-005 | L3 | runId 对象产品 API 逆序清理 | PASS | `DELETE /api/files/66` 200；临时空间亦以产品 API 200 清理 |
| L4 | L4 | 从最新 lint-fix 重跑受影响 AUTHZ/RBAC/WIKI/FILE 矩阵 | PENDING | 后续最终 L4 |

PASS 需要零未解释 5xx、零未解释 console error、严格预检与 API 证据一致；不以源码或单测替代运行时验证。

运行时证据：`test-results/FQA_20260717_1245_final_l4/REM-P0-003-shadow-create-observation/result.json`（待最终台账提交时强制暂存）。
