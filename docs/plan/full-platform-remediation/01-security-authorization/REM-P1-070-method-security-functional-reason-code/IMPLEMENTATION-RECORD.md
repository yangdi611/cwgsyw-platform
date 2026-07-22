# 实施记录

## 2026-07-21：发现与认领

- L4 `RBAC-025/XL-RBAC-006` 在 scope、资源 ACL、ancestor 三层精确 reason code 均通过后，删除最后一条功能 assignment 的请求返回 HTTP 403，但缺少 `FUNCTION_PERMISSION_DENIED`。失败证据 `/tmp/fqa-2050-rbac-remaining-after-rem-p1-069-r3`，快照 `79c1ffec`。
- 分支从 `lint-fix@407f1abe` 创建；事件 run `REM_P1_070_20260721`。失败运行 shared manifest 为 `objects=[]`、`cleanupFailures=0`。
- GitNexus：`filterChain` upstream LOW、0 直接调用者/流程；`GlobalExceptionHandler.handleAccessDenied` upstream LOW、0 直接调用者/流程。两者是全局安全基础设施，按全局权限响应风险执行聚类与运行时复验。

## 2026-07-21：实现与 L1-L3

- 首轮为 Security filter 注册 `FunctionalPermissionAccessDeniedHandler`，但真实 API 仍只有通用 `{code:403}`，证明方法安全异常不经过 filter handler；失败尝试的测试对象由 finally 通过产品 API全部清理。
- 根因修复位于 MVC `GlobalExceptionHandler.handleAccessDenied`：返回 `R.fail(403, "FUNCTION_PERMISSION_DENIED", "无权限")`。filter handler 保留同一合同，覆盖 filter 链自身产生的已认证拒绝。
- 新增两条 Java 精确测试及真实 API Playwright 回归。Java 21 安全/授权定向簇退出码 0；测试 fixture 产生的预期 data-integrity ERROR 日志不是失败。
- 当前分支生产 backend 编译 553 source，仅替换 backend；容器 healthy，Flyway V79，无启动 ERROR。
- Playwright 首次真实复验确认 reason code 已出现，但断言错误地要求全局 `non_null` 配置下仍序列化 `data:null`；修正为缺省或 null 均接受后，最终 `1/1` 在 2.2 秒通过。
- 运行创建的页面、空间、assignment、用户和角色全部通过产品 API 逆序删除；backend 无 ERROR/未处理 5xx。合并后在同一 L4 run 复跑原组合资产，才提升 `RBAC-025/XL-RBAC-006`。
