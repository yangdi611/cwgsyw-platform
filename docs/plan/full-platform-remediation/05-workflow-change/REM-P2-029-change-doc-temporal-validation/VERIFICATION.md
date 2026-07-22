# REM-P2-029 验证矩阵

| AC | 层级 | 检查 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | L1 | 标量和表格 `date`/`datetime` 的合法日期、闰年与秒级日期时间 | PASS | 项目 JDK 21 直接编译目标测试类并用 JUnit Platform 执行 `TableFieldSupportTest`，`24/24` 通过。 |
| AC-002 | L1 | 非法月份/日期、非 ISO 文本、无效时分、offset datetime 被拒绝 | PASS | 同一 `24/24` 定向测试；全仓 Maven testCompile/Surefire 的既有无关错误与未展开 ByteBuddy agent 已另行记录。 |
| AC-002 | L2 | 真实会话 API create/update/submit 无效值均 400，关键词回读零对象 | PASS | 当前分支容器：创建非法 date/datetime、更新非法 date 均 400；合法 #215 提交 200，字段回读未被失败更新改写。 |
| AC-003 | L2 | 既有 required/number/enum 负向与合法日期正向状态转换 | PASS | `CHANGE-005` 原始证据保留 required/number/enum；本次合法闰年日期与秒级 datetime 创建/submit 200。 |
| AC-004 | L3 | 当前分支重建 backend，真实新建页输入合法日期并创建；非法 API 无残留，Console/API 无未解释错误 | PASS | 隔离 Playwright Chromium 使用正常产品会话进入 `/change-docs/new`，选择模板 #11、填写 `2024-02-29`/`2026-07-17T13:45`，创建 #216 并跳转详情；Console/API 失败均为 0。 |

## 测试数据与阻断

- runId `REM_P2_029_20260717_0831` 的模板 #9、文档 #214，`REM_P2_029_20260717_0840` 的模板 #10、文档 #215，以及 UI runId 的模板 #11、文档 #216 均已仅经产品 API 删除；关键词回读均为 `total=0`。
