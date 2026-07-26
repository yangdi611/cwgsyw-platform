package com.cwgsyw.platform.module.cmdb.spatial.mapper;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** Batched spatial runtime queries. None of these write or change legacy CMDB semantics. */
@Mapper
public interface SpatialRuntimeMapper {
    @Select("""
        SELECT room.id AS "roomInstanceId", room.name, layout.id AS "layoutId"
        FROM ci_instance room
        LEFT JOIN ci_spatial_layout layout ON layout.tenant_id = room.tenant_id
            AND layout.room_instance_id = room.id AND NOT layout.is_deleted AND layout.status = 'ACTIVE'
        WHERE room.tenant_id = #{tenantId} AND room.model_id = 'idc_room' AND NOT room.is_deleted
          AND (#{keyword} = '' OR room.name ILIKE '%' || #{keyword} || '%')
          AND (NOT #{configured} OR layout.id IS NOT NULL)
        ORDER BY room.name, room.id
        LIMIT #{size} OFFSET #{offset}
        """)
    List<Map<String, Object>> listRooms(@Param("tenantId") String tenantId, @Param("keyword") String keyword,
                                         @Param("configured") boolean configured, @Param("size") int size, @Param("offset") int offset);

    @Select("""
        SELECT rack.id AS "ciInstanceId", rack.name, rack.model_id AS "modelId", rack.status,
               EXISTS (SELECT 1 FROM ci_spatial_binding b
                       WHERE b.layout_version_id = layout.draft_version_id AND b.ci_instance_id = rack.id) AS "bound"
        FROM ci_spatial_layout layout
        JOIN ci_instance_rel rel ON rel.tenant_id = layout.tenant_id AND NOT rel.is_deleted
            AND rel.src_id = layout.room_instance_id AND rel.def_id = 'room_contains_rack'
        JOIN ci_instance rack ON rack.id = rel.dst_id AND rack.tenant_id = layout.tenant_id AND NOT rack.is_deleted
        WHERE layout.id = #{layoutId} AND layout.tenant_id = #{tenantId} AND NOT layout.is_deleted
          AND rack.model_id = 'rack' AND (#{keyword} = '' OR rack.name ILIKE '%' || #{keyword} || '%')
        ORDER BY rack.name, rack.id LIMIT #{size} OFFSET #{offset}
        """)
    List<Map<String, Object>> rackCandidates(@Param("layoutId") Long layoutId, @Param("tenantId") String tenantId,
                                              @Param("keyword") String keyword, @Param("size") int size, @Param("offset") int offset);

    @Select("""
        SELECT ci.id AS "ciInstanceId", ci.name, ci.model_id AS "modelId", ci.status,
               EXISTS (SELECT 1 FROM ci_spatial_binding b
                       WHERE b.layout_version_id = layout.draft_version_id AND b.ci_instance_id = ci.id) AS "bound"
        FROM ci_spatial_layout layout
        JOIN ci_instance ci ON ci.tenant_id = layout.tenant_id AND NOT ci.is_deleted
        WHERE layout.id = #{layoutId} AND layout.tenant_id = #{tenantId} AND NOT layout.is_deleted
          AND ci.id <> layout.room_instance_id AND ci.model_id <> 'rack'
          AND (#{modelId} = '' OR ci.model_id = #{modelId})
          AND (#{keyword} = '' OR ci.name ILIKE '%' || #{keyword} || '%')
        ORDER BY ci.name, ci.id LIMIT #{size} OFFSET #{offset}
        """)
    List<Map<String, Object>> facilityCandidates(@Param("layoutId") Long layoutId, @Param("tenantId") String tenantId,
                                                  @Param("keyword") String keyword, @Param("modelId") String modelId,
                                                  @Param("size") int size, @Param("offset") int offset);

    @Select("""
        SELECT b.element_id AS "elementId", ci.id AS "ciInstanceId", ci.name AS "ciName", ci.model_id AS "ciModelId", ci.status AS "ciStatus",
               COALESCE(alerts.active_alert_count, 0) AS "activeAlertCount", alerts.highest_severity AS "highestSeverity",
               COALESCE((ci.attrs->>'rack_height_u')::int, 42) AS "heightU",
               COALESCE(members.used_u, 0) AS "usedU", COALESCE(members.device_count, 0) AS "deviceCount"
        FROM ci_spatial_layout layout
        JOIN ci_spatial_binding b ON b.layout_version_id = layout.published_version_id AND b.tenant_id = layout.tenant_id
        LEFT JOIN ci_instance ci ON ci.id = b.ci_instance_id AND ci.tenant_id = b.tenant_id AND NOT ci.is_deleted
        LEFT JOIN LATERAL (
            SELECT COUNT(*) FILTER (WHERE alert.status = 'firing') AS active_alert_count,
                   (ARRAY_AGG(alert.severity ORDER BY CASE alert.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END))[1] AS highest_severity
            FROM cmdb_alert alert
            WHERE alert.tenant_id = b.tenant_id AND alert.ci_instance_id = b.ci_instance_id AND NOT alert.is_deleted AND alert.status = 'firing'
        ) alerts ON true
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS device_count,
                   COALESCE(SUM(GREATEST(0, LEAST(COALESCE((ci.attrs->>'rack_height_u')::int, 42), NULLIF(member.attrs->>'u_end','')::int)
                        - GREATEST(1, NULLIF(member.attrs->>'u_start','')::int) + 1)), 0) AS used_u
            FROM ci_instance_rel rel
            JOIN ci_instance member ON member.id = rel.dst_id AND member.tenant_id = rel.tenant_id AND NOT member.is_deleted
            WHERE rel.tenant_id = b.tenant_id AND NOT rel.is_deleted AND rel.src_id = b.ci_instance_id AND rel.def_id LIKE 'rack_contains_%'
        ) members ON b.element_type = 'RACK_SLOT'
        WHERE layout.id = #{layoutId} AND layout.tenant_id = #{tenantId} AND NOT layout.is_deleted
          AND layout.published_version_id IS NOT NULL
        """)
    List<Map<String, Object>> runtimeRows(@Param("layoutId") Long layoutId, @Param("tenantId") String tenantId);

    @Select("""
        SELECT DISTINCT room.id AS "roomInstanceId", room.name AS "roomName", layout.id AS "layoutId",
               layout.published_version_id AS "publishedVersionId", binding.element_id AS "elementId",
               target.id AS "targetCiInstanceId", target.name AS "targetCiName", target.model_id AS "targetModelId",
               rack.id AS "rackCiInstanceId", rack.name AS "rackName", binding.display_name_snapshot AS "snapshotName"
        FROM ci_spatial_layout layout
        JOIN ci_instance room ON room.id = layout.room_instance_id AND room.tenant_id = layout.tenant_id AND NOT room.is_deleted
        JOIN ci_spatial_binding binding ON binding.layout_version_id = layout.published_version_id AND binding.tenant_id = layout.tenant_id
        JOIN ci_instance rack ON rack.id = binding.ci_instance_id AND rack.tenant_id = binding.tenant_id AND NOT rack.is_deleted
        LEFT JOIN ci_instance_rel rel ON rel.tenant_id = layout.tenant_id AND NOT rel.is_deleted
            AND rel.src_id = rack.id AND rel.def_id LIKE 'rack_contains_%'
        LEFT JOIN ci_instance target ON target.id = COALESCE(CASE WHEN rack.id = #{ciId} THEN rack.id ELSE rel.dst_id END, rack.id)
            AND target.tenant_id = layout.tenant_id AND NOT target.is_deleted
        WHERE layout.tenant_id = #{tenantId} AND layout.status = 'ACTIVE' AND NOT layout.is_deleted
          AND layout.published_version_id IS NOT NULL
          AND (rack.id = #{ciId} OR rel.dst_id = #{ciId})
        """)
    List<Map<String, Object>> locateByCi(@Param("ciId") Long ciId, @Param("tenantId") String tenantId);

    @Select("""
        SELECT room.id AS "roomInstanceId", room.name AS "roomName", layout.id AS "layoutId",
               layout.published_version_id AS "publishedVersionId", binding.element_id AS "elementId",
               COALESCE(target.id, rack.id) AS "targetCiInstanceId", COALESCE(target.name, rack.name) AS "targetCiName",
               COALESCE(target.model_id, rack.model_id) AS "targetModelId",
               rack.id AS "rackCiInstanceId", rack.name AS "rackName"
        FROM ci_spatial_layout layout
        JOIN ci_instance room ON room.id = layout.room_instance_id AND room.tenant_id = layout.tenant_id AND NOT room.is_deleted
        JOIN ci_spatial_binding binding ON binding.layout_version_id = layout.published_version_id AND binding.tenant_id = layout.tenant_id
        JOIN ci_instance rack ON rack.id = binding.ci_instance_id AND rack.tenant_id = binding.tenant_id AND NOT rack.is_deleted
        LEFT JOIN ci_instance_rel rel ON rel.tenant_id = layout.tenant_id AND NOT rel.is_deleted
            AND rel.src_id = rack.id AND rel.def_id LIKE 'rack_contains_%'
        LEFT JOIN ci_instance target ON target.id = rel.dst_id AND target.tenant_id = layout.tenant_id AND NOT target.is_deleted
        WHERE layout.tenant_id = #{tenantId} AND layout.status = 'ACTIVE' AND NOT layout.is_deleted
          AND layout.published_version_id IS NOT NULL
          AND (rack.name ILIKE '%' || #{keyword} || '%'
               OR COALESCE(target.name, '') ILIKE '%' || #{keyword} || '%'
               OR COALESCE(target.attrs::text, '') ILIKE '%' || #{keyword} || '%')
        ORDER BY room.name, rack.name, target.name NULLS FIRST LIMIT #{size}
        """)
    List<Map<String, Object>> locateByKeyword(@Param("keyword") String keyword, @Param("tenantId") String tenantId,
                                                @Param("size") int size);
}
