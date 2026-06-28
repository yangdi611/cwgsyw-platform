-- V60: 软删两个不再使用的内置模型分类（host_manage 主机管理 / network 网络设备）
-- 背景：
--   * V14 种子建了 host_manage / network 两个内置分组。
--   * V59 已把 host / san_switch / net_switch 全部归并到 hardware（硬件设备），
--     这两个分组从此为空且无意义。
--   * 后端 delete() 禁止删除内置分组，界面无法删除，故由本迁移软删。
--
-- 软删约定（项目规范）：置 is_deleted=TRUE + deleted_at，不物理删除。
-- deleted_by=0 表示系统自动操作。
-- 条件化：仅当分组当前没有任何「未删除」模型引用时才删，
-- 避免误删 UAT 上被人工重新使用的分组。

UPDATE ci_model_group g
   SET is_deleted = TRUE,
       deleted_at = now(),
       deleted_by = 0
 WHERE g.tenant_id = 'default'
   AND g.code IN ('host_manage', 'network')
   AND NOT g.is_deleted
   AND NOT EXISTS (
        SELECT 1 FROM ci_model m
         WHERE m.tenant_id = 'default'
           AND m.group_code = g.code
           AND NOT m.is_deleted
   );
