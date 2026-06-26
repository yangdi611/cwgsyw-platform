-- V55: Wiki 空间写权限范围（支持多个 seed 空间的不同读写策略）
-- write_scope 控制谁能在该空间写：
--   NULL             用户自建空间（不受此约束，走常规 RBAC + 页面 ACL）
--   'none'           仅 admin/super_admin（如平台使用手册）
--   'super_admin_only' 仅 super_admin（如 Release Notes）
--   'all'            所有登录用户可读写（如 Bug 反馈）
-- 前端据此控制写操作入口；后端 submitForReview/ACL 据此放行或拒绝。

ALTER TABLE wiki_space ADD COLUMN IF NOT EXISTS write_scope VARCHAR(32);
