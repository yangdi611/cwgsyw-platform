# REM-P1-061 执行入口

本事件只处理变更文档直接审批与 workflow 完成的申请人通知一致性。先读根 Goal 合同、检查点、SPEC 与 VERIFICATION；编辑符号前运行 GitNexus upstream impact，提交前运行 detect_changes。

必须证明通过/拒绝、长/空意见、`change_doc` 引用、单次投递和重复终态无副作用。不得使用 SQL 写入、restore、对象存储直接删除、Redis/卷清空或全租户授权切换。完成 L1-L3 后独立提交、`--no-ff` 合并到 `lint-fix`，再从同一 L4 run 重验 `CHANGE-011/012`。
