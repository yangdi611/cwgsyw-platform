-- V41: Backfill ci_instance_rel.def_id to reference ci_association_def.def_id (AC3, AD-3)
--
-- 背景：历史创建链路把裸 association kind code（如 "run"）直接写进了 ci_instance_rel.def_id
-- 列；而该列语义应指向 ci_association_def.def_id。本迁移为观测到的每个
-- (src_model, dst_model, kind) 组合推导或创建正确的 ci_association_def 行，并把关系回填指向它。
--
-- 幂等：可安全重复执行——
--   * def 仅在缺失时创建（NOT EXISTS + ON CONFLICT）
--   * 仅当关系当前 def_id 未指向有效 def 时才回填（Step A 已合规行与重跑均跳过）
--   * 推导不出 def 的关系保持原值，记入 unresolved 报告供人工处理

DO $$
DECLARE
    v_total      INT;
    v_compliant  INT;
    v_backfilled INT;
    v_unresolved INT;
BEGIN
    SELECT COUNT(*) INTO v_total
    FROM ci_instance_rel r WHERE NOT r.is_deleted;

    -- Step A：已指向有效 def 的关系（无需变更）。
    SELECT COUNT(*) INTO v_compliant
    FROM ci_instance_rel r
    WHERE NOT r.is_deleted
      AND EXISTS (SELECT 1 FROM ci_association_def d
                  WHERE d.tenant_id = r.tenant_id
                    AND d.def_id = r.def_id
                    AND NOT d.is_deleted);

    -- Step B/C：为观测到的每个 (tenant, src_model, dst_model, kind) 组合确保存在一条 def。
    --           当前 def_id 列存的是 kind code，故作为 kind_id 写入新 def。
    INSERT INTO ci_association_def
        (tenant_id, def_id, kind_id, src_model_id, dst_model_id, name, mapping, on_delete, is_built_in, created_at)
    SELECT DISTINCT
        r.tenant_id,
        r.def_id || '_' || si.model_id || '__' || di.model_id,
        r.def_id,
        si.model_id,
        di.model_id,
        COALESCE(k.name, r.def_id),
        'n:n',
        'none',
        FALSE,
        NOW()
    FROM ci_instance_rel r
    JOIN ci_instance si ON si.id = r.src_id
    JOIN ci_instance di ON di.id = r.dst_id
    LEFT JOIN ci_association_kind k ON k.tenant_id = r.tenant_id AND k.kind_id = r.def_id
    WHERE NOT r.is_deleted
      AND NOT EXISTS (
          SELECT 1 FROM ci_association_def d
          WHERE d.tenant_id = r.tenant_id
            AND d.kind_id    = r.def_id
            AND d.src_model_id = si.model_id
            AND d.dst_model_id = di.model_id
            AND NOT d.is_deleted
      )
    ON CONFLICT (tenant_id, def_id) DO NOTHING;

    -- 回填：仅对当前 def_id 未指向有效 def 的关系，按 (kind, src_model, dst_model) 推导新 def_id。
    WITH backfill AS (
        SELECT r2.id AS rel_id,
               (SELECT d.def_id
                FROM ci_association_def d
                JOIN ci_instance si ON si.id = r2.src_id
                JOIN ci_instance di ON di.id = r2.dst_id
                WHERE d.tenant_id    = r2.tenant_id
                  AND d.kind_id      = r2.def_id
                  AND d.src_model_id = si.model_id
                  AND d.dst_model_id = di.model_id
                  AND NOT d.is_deleted
                LIMIT 1) AS new_def_id
        FROM ci_instance_rel r2
        WHERE NOT r2.is_deleted
    )
    UPDATE ci_instance_rel r
    SET def_id = b.new_def_id
    FROM backfill b
    WHERE r.id = b.rel_id
      AND b.new_def_id IS NOT NULL
      AND b.new_def_id <> r.def_id
      AND NOT EXISTS (SELECT 1 FROM ci_association_def d
                      WHERE d.tenant_id = r.tenant_id
                        AND d.def_id    = r.def_id
                        AND NOT d.is_deleted);

    GET DIAGNOSTICS v_backfilled = ROW_COUNT;

    v_unresolved := GREATEST(v_total - v_compliant - v_backfilled, 0);

    RAISE NOTICE 'V41 ci_instance_rel.def_id backfill: total=%, already_compliant=%, backfilled=%, unresolved(no derivable def)=%',
        v_total, v_compliant, v_backfilled, v_unresolved;
END $$;
