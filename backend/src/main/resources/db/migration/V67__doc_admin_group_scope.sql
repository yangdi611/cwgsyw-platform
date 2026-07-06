-- 文档管理员角色误配为 scope=tenant，被各模块 isAdmin(groupScope) 判断当成租户级管理员，
-- 绕过 Wiki 空间/页面 ACL、系统空间锁定、共享文件夹 ACL 等所有限制，与其实际权限（仅两个 CMDB 只读权限）
-- 及角色描述"管理共享文档"严重不符。改为 group，回到普通角色的权限判定路径。
UPDATE sys_role SET scope = 'group' WHERE code = 'doc_admin';
