# REM-P1-060 执行入口

本事件只处理变更文档 submit/approve 并发幂等和同一终端测试链的精确清理。先读根 Goal 合同、检查点、SPEC 与 VERIFICATION；编辑符号前运行 GitNexus upstream impact，提交前运行 detect_changes。

必须证明 submit 与 approve 各自 `200/409`、唯一状态副作用、导出/权限边界和产品 API 清理零残留。不得使用 SQL、restore、对象存储直接删除、Redis/卷清空或全租户授权切换。完成 L1-L3 后独立提交、`--no-ff` 合并到 `lint-fix`，再从同一 L4 run 继续受影响用例。
