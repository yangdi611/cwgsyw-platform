-- V49: 双模板变更文档功能收尾占位（无 schema 变更）
--
-- 该迁移仅作版本号占位与说明，方便追溯"双模板"功能完整落地的时间点。
-- 真正的 schema 变更（双模板外键、doc_type 列）由 V13 完成。
--
-- 2026-06: 完成前端双模板 UI、状态机扩展（draft / plan_pending / pending / approved / rejected）、
--          导出按模板分别生成 1-2 份 Word + PDF、审批通过后自动归档到共享文件库。
-- 状态值 plan_pending 通过应用层枚举控制，change_doc.status 仍为 VARCHAR(32) 无 CHECK 约束。

SELECT 1;
