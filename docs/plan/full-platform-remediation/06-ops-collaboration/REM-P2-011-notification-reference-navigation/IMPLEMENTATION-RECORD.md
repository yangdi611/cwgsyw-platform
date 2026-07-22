# REM-P2-011 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-025`；用例：`NOTICE-002`。
- 根因：通知 producer 的 refType 集合与 NotificationItem.getHref 映射未共享注册表。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始，追加 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-16：L1-L3 实施与复验结算

- 认领分支：`codex/rem-p2-011-notification-reference-navigation`，基线：`lint-fix@3d7d2b72341310e91be92a97229e15ffb128d863`。
- 影响分析：`getHref` 为 LOW（`NotificationItem`、`NotificationsPage`）；通知投递 `NotificationService.notify` 为 CRITICAL（11 直接调用者），未编辑，避免扩大投递和授权风险。
- 实现：通知卡片只对已知 producer refType 提供受控解析链接；解析页先调用既有受权限保护的读取 API，再跳转到实际 Wiki、变更、日报、CI 或运维任务路由。Wiki/CI 需要的空间/模型信息来自已授权的读取响应，不从通知 payload 猜测。
- 拒绝与删除：未知 refType、非法 ID、404 或 403 均落入同一中性不可用页，不显示目标名称、空间、模型或权限原因；无通知投递、已读、审计或权限副作用。
- L3：当前事件分支 frontend 容器重建并健康；真实登录、通知卡片点击至现有 Wiki 页面、运维任务抽屉、删除/未知目标友好态均通过。成功跳转路径 Console error=0。
- 静态验证：变更文件 eslint、frontend typecheck 和 production build 均通过；无产品测试数据，回滚为还原本事件提交。
