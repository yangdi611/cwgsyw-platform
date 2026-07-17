# REM-P2-029 执行入口

在 `/Users/byron/AI/cwgsyw-platform` 继续唯一事件 `REM-P2-029：变更文档日期与日期时间有效性校验`。先读取根 `AGENTS.md`、整改总台账、本目录五件套和 L4 `CHANGE-005`；原始 FAIL 必须保留。

只修改变更文档动态字段服务边界：所有标量和表格 `date`/`datetime` 使用严格本地 ISO 日历解析。保留 required 空值、number、enum、权限、状态机、路由、历史数据和普通删除合同。不得以 UI 限制替代后端校验，且不得修改 Redis、会话、数据库卷、SQL 或对象存储。

编辑符号前运行 GitNexus upstream impact；必须覆盖合法日期、闰年、非法日期/时间/格式、create/update/submit 无副作用和当前分支容器 UI/API。所有 runId 对象只经产品 API 清理。完成后回写五件套与全局台账，提交、no-ff 合并到 `lint-fix`，再重跑 `CHANGE-005`。
