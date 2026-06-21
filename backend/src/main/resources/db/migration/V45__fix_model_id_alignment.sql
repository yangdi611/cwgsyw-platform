-- V45: 对齐子表 model_id 引用：从 ci_model.model_id 列值 改为 ci_model.name 列值
--
-- 背景:
-- 服务层（CiAttributeService / CiInstanceService）统一使用 CiModel.getName()
-- 作为子表的 model_id 外键值进行查询。但 CiModel.getModelId() 实际返回 name 列，
-- CiModelMapper.findByName 也是 WHERE model_id = #{name} 解析路径参数。
-- 因此系统的"模型标识"约定是 ci_model.name（如 '主机'/'应用'）。
--
-- 而 V14/V20 种子数据在子表中存储的是 ci_model.model_id 列值（'host'/'app'），
-- 导致 listByModel('主机') 等查询 WHERE model_id='主机' 返回 0 行 → 属性不可用、
-- 实例创建时 schema 校验找不到属性 → 创建失败。
--
-- 本迁移将子表中存储的 ci_model.model_id 列值统一改为 ci_model.name 列值，
-- 使种子数据与服务层（及服务层创建的数据）保持一致。
-- 所有 UPDATE 均带 model_id != name 守卫，幂等可重复执行。

-- 1) 对齐 ci_attribute.model_id
UPDATE ci_attribute ca
SET model_id = m.name
FROM ci_model m
WHERE ca.tenant_id = m.tenant_id
  AND ca.model_id  = m.model_id
  AND ca.model_id != m.name
  AND NOT m.is_deleted;

-- 2) 对齐 ci_attribute_group.model_id
UPDATE ci_attribute_group cag
SET model_id = m.name
FROM ci_model m
WHERE cag.tenant_id = m.tenant_id
  AND cag.model_id  = m.model_id
  AND cag.model_id != m.name
  AND NOT m.is_deleted;

-- 3) 对齐 ci_instance.model_id（如有历史数据存的是 model_id 列值）
UPDATE ci_instance ci
SET model_id = m.name
FROM ci_model m
WHERE ci.tenant_id = m.tenant_id
  AND ci.model_id  = m.model_id
  AND ci.model_id != m.name
  AND NOT m.is_deleted;

-- 4) 对齐 ci_association_def.src_model_id
UPDATE ci_association_def cad
SET src_model_id = m.name
FROM ci_model m
WHERE cad.tenant_id = m.tenant_id
  AND cad.src_model_id = m.model_id
  AND cad.src_model_id != m.name
  AND NOT m.is_deleted;

-- 5) 对齐 ci_association_def.dst_model_id
UPDATE ci_association_def cad
SET dst_model_id = m.name
FROM ci_model m
WHERE cad.tenant_id = m.tenant_id
  AND cad.dst_model_id = m.model_id
  AND cad.dst_model_id != m.name
  AND NOT m.is_deleted;
