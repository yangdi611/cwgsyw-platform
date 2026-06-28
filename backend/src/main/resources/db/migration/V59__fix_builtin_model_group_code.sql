-- V59: 修正内置模型的初始分类归属（纠正 V14 / V56 的种子错误）
-- 背景：
--   * host        在 V14 以 group_code='host_manage' 插入，应归属 hardware（硬件设备）。
--   * san_switch  在 V56 以 group_code='network'      插入，应归属 hardware。
--   * net_switch  在 V56 以 group_code='network'      插入，应归属 hardware。
-- 不能修改已应用的 V14/V56（Flyway checksum 会失败），故用本迁移 UPDATE 纠正。
--
-- 幂等 + 尊重人工调整：仅当 group_code 仍为「错误的原始种子值」时才纠正。
-- 若管理员事后已手动改到别的分类，则条件不满足、跳过，不覆盖人工选择。
-- dev 环境若已手动改对（现为 hardware），同样跳过，无副作用。

UPDATE ci_model SET group_code = 'hardware'
 WHERE tenant_id = 'default' AND model_id = 'host'       AND group_code = 'host_manage' AND NOT is_deleted;

UPDATE ci_model SET group_code = 'hardware'
 WHERE tenant_id = 'default' AND model_id = 'san_switch' AND group_code = 'network'     AND NOT is_deleted;

UPDATE ci_model SET group_code = 'hardware'
 WHERE tenant_id = 'default' AND model_id = 'net_switch' AND group_code = 'network'     AND NOT is_deleted;
