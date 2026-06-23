-- V47: 子表 model 引用统一为 ASCII ci_model.model_id（撤销 V45 的错误方向）
--
-- 背景：
--   ci_model 有两列：model_id（ASCII 规范码，如 'host'）与 name（中文，如 '主机'）。
--   服务层历史上误用 model.getName()（中文）作为子表 FK 写入/查询；V45 又把子表 FK
--   从 ASCII 改成了中文，让系统“自洽地”以中文 name 为键。
--   本次将子表 FK 从中文 name 改回 ASCII model_id，并配合服务层改用 getModelId() 作为 FK。
--   中文展示名仍保留在 ci_model.display_name，不受影响。
--
-- 幂等：若 FK 已是 ASCII，则 = m.name 不命中，空操作。
-- 顺序：用 ci_model.name → model_id 映射更新子表（此时 name 仍为中文，映射成立）。

UPDATE ci_instance i
   SET model_id = m.model_id
  FROM ci_model m
 WHERE i.tenant_id = m.tenant_id
   AND i.model_id = m.name
   AND NOT m.is_deleted;

UPDATE ci_attribute a
   SET model_id = m.model_id
  FROM ci_model m
 WHERE a.tenant_id = m.tenant_id
   AND a.model_id = m.name
   AND NOT m.is_deleted;

UPDATE ci_attribute_group g
   SET model_id = m.model_id
  FROM ci_model m
 WHERE g.tenant_id = m.tenant_id
   AND g.model_id = m.name
   AND NOT m.is_deleted;

UPDATE ci_change_record c
   SET model_code = m.model_id
  FROM ci_model m
 WHERE c.model_code = m.name
   AND NOT m.is_deleted;

UPDATE ci_association_def d
   SET src_model_id = m.model_id
  FROM ci_model m
 WHERE d.src_model_id = m.name
   AND NOT m.is_deleted;

UPDATE ci_association_def d
   SET dst_model_id = m.model_id
  FROM ci_model m
 WHERE d.dst_model_id = m.name
   AND NOT m.is_deleted;
