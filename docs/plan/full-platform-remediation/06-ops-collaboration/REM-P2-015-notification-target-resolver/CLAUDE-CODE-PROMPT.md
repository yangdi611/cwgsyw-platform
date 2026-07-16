# REM-P2-015 Codex 执行入口

只完成 `REM-P2-015：通知目标只读解析端点`。先读仓库规则、总索引/检查点、本目录五件套和 REM-P2-011 历史证据；从本实施记录的第一未完成门禁继续。

用户已确认可新增只读、权限感知端点。端点只接受当前用户 notification ID，先检查归属，返回最小 `{available, href}`；无权、失效、未知、他人通知统一中性不可用，不能泄露目标详情。不得改通知投递、已读、权限模型、对象 ACL 或路由。编辑每个符号前执行 GitNexus upstream impact；共享 NotificationService 为 MEDIUM，禁止改其投递路径。完成 L1-L3、当前分支容器/API/UI、精确清理、证据回写、detect_changes、独立提交和 --no-ff 合并后才回到最终 L4。
