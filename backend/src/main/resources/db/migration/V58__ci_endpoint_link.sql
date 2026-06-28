-- ─────────────────────────────────────────────────────────────────────────────
-- V58: ci_endpoint_link 连接表（P3，spec §8）
--
-- 端口/LUN 级别的连接事实源。端点用稳定 row_id（端点 UID）而非端口显示名，
-- 端口改名连接不漂移。EndpointLinkService 是唯一写入口，并同步 ci_instance_rel
-- 的 connect 类 managed 镜像边（拓扑图复用现有 findTopologyEdges，无需改）。
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ci_endpoint_link (
  id                 BIGSERIAL PRIMARY KEY,
  tenant_id          VARCHAR(64) NOT NULL DEFAULT 'default',
  link_type          VARCHAR(16) NOT NULL,            -- net | fc | lun
  src_instance_id    BIGINT NOT NULL,
  src_field_key      VARCHAR(64) NOT NULL,            -- nics | ports | fc_ports | luns
  src_endpoint_uid   VARCHAR(128) NOT NULL,           -- = table 行 row_id（稳定）
  src_endpoint_label VARCHAR(128),                    -- 端口显示名（可变，仅展示）
  dst_instance_id    BIGINT NOT NULL,
  dst_field_key      VARCHAR(64),
  dst_endpoint_uid   VARCHAR(128),
  dst_endpoint_label VARCHAR(128),
  attrs              JSONB NOT NULL DEFAULT '{}',
  is_deleted         BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at         TIMESTAMP,
  deleted_by         BIGINT,
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by         BIGINT NOT NULL DEFAULT 0,
  updated_by         BIGINT
);

-- 唯一索引含 link_type + field_key：不同类型/不同端点表不互相冲突（评审 3.9）。
-- net/fc 端口只占一次；lun storage 侧只分配一次、host 侧可空。
CREATE UNIQUE INDEX IF NOT EXISTS uq_endpoint_link_src ON ci_endpoint_link
  (tenant_id, link_type, src_instance_id, src_field_key, src_endpoint_uid) WHERE NOT is_deleted;
CREATE UNIQUE INDEX IF NOT EXISTS uq_endpoint_link_dst ON ci_endpoint_link
  (tenant_id, link_type, dst_instance_id, dst_field_key, dst_endpoint_uid)
  WHERE NOT is_deleted AND dst_field_key IS NOT NULL AND dst_endpoint_uid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_endpoint_link_src_ci ON ci_endpoint_link(tenant_id, src_instance_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_endpoint_link_dst_ci ON ci_endpoint_link(tenant_id, dst_instance_id) WHERE NOT is_deleted;

-- connect 类关联 def（managed 镜像边用）。on_delete=none：连接删除由 EndpointLinkService 维护。
INSERT INTO ci_association_def (tenant_id, def_id, kind_id, src_model_id, dst_model_id, name, mapping, on_delete, is_built_in) VALUES
('default','host_connect_netsw',  'connect','host','net_switch','主机连交换机','n:n','none',TRUE),
('default','host_connect_san',    'connect','host','san_switch','主机连SAN',  'n:n','none',TRUE),
('default','san_connect_storage', 'connect','san_switch','storage','SAN连存储','n:n','none',TRUE),
('default','storage_lun_host',    'connect','storage','host','LUN分配',       'n:n','none',TRUE)
ON CONFLICT (tenant_id, def_id) DO NOTHING;
