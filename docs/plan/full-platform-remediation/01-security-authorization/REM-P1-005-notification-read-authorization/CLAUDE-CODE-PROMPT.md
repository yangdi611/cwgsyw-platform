# REM-P1-005 执行提示

处理 `BUG-FQA-008` 时，只收敛 `notification:read` 的通知读取授权。修改前对 Controller、路由守卫和页头铃铛执行 GitNexus impact；API、直达路由和全局铃铛必须使用同一权限合同。禁止修改通知投递、角色 seed 或历史通知数据；无权限回归不得执行已读写操作。完成后运行通知定向测试、前端 lint/typecheck（依赖可用时）和 `detect_changes`，并保留 L4 全量 FQA 门禁。
