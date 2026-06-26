-- V52: 清理从未使用的密码访问日志表
-- password_access_log 在 V6 建表后从未被写入/读取，密码查看审计实际统一记录在 audit_log
-- (module='device', action='view_password')。此表为孤儿 schema，安全删除。

DROP TABLE IF EXISTS password_access_log;
