package com.cwgsyw.platform.module.cmdb.spatial.service;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.cmdb.spatial.dto.*;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialLayout;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialLayoutMapper;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.SpatialRuntimeMapper;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read-only projection for viewers. Runtime status is not persisted in spatial documents. */
@Service
@RequiredArgsConstructor
public class SpatialRuntimeService {
    private final SpatialRuntimeMapper runtimeMapper;
    private final SpatialLayoutMapper layoutMapper;

    @Transactional(readOnly = true)
    public List<SpatialRoomVO> rooms(String keyword, boolean configured, int page, int size, String tenantId) {
        requirePage(page, size);
        return runtimeMapper.listRooms(tenantId, safe(keyword), configured, size, (page - 1) * size).stream()
                .map(row -> new SpatialRoomVO(longValue(row, "roomInstanceId"), stringValue(row, "name"),
                        row.get("layoutId") != null, longValue(row, "layoutId"))).toList();
    }

    @Transactional(readOnly = true)
    public List<SpatialCandidateVO> rackCandidates(Long layoutId, String keyword, int page, int size, String tenantId) {
        requireLayout(layoutId, tenantId);
        requirePage(page, size);
        return candidates(runtimeMapper.rackCandidates(layoutId, tenantId, safe(keyword), size, (page - 1) * size));
    }

    @Transactional(readOnly = true)
    public List<SpatialCandidateVO> facilityCandidates(Long layoutId, String keyword, String modelId, int page, int size, String tenantId) {
        requireLayout(layoutId, tenantId);
        requirePage(page, size);
        return candidates(runtimeMapper.facilityCandidates(layoutId, tenantId, safe(keyword), safe(modelId), size, (page - 1) * size));
    }

    @Transactional(readOnly = true)
    public SpatialRuntimeVO runtime(Long layoutId, String tenantId) {
        SpatialLayout layout = requireLayout(layoutId, tenantId);
        if (layout.getPublishedVersionId() == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "SPATIAL_PUBLISHED_NOT_FOUND", "布局尚未发布，无法读取运行图层");
        }
        Map<String, SpatialRuntimeElementVO> elements = new LinkedHashMap<>();
        for (Map<String, Object> row : runtimeMapper.runtimeRows(layoutId, tenantId)) {
            String elementId = stringValue(row, "elementId");
            String modelId = stringValue(row, "ciModelId");
            int height = intValue(row, "heightU", 42);
            int used = Math.max(0, Math.min(height, intValue(row, "usedU", 0)));
            List<String> quality = row.get("ciInstanceId") == null ? List.of("CI_MISSING") : List.of();
            SpatialRuntimeElementVO.SpatialRackSummary rack = "rack".equals(modelId)
                    ? new SpatialRuntimeElementVO.SpatialRackSummary(height, used, height - used, intValue(row, "deviceCount", 0)) : null;
            elements.put(elementId, new SpatialRuntimeElementVO(longValue(row, "ciInstanceId"), stringValue(row, "ciName"),
                    modelId, stringValue(row, "ciStatus"), longValue(row, "activeAlertCount") == null ? 0 : longValue(row, "activeAlertCount"),
                    stringValue(row, "highestSeverity"), rack, quality));
        }
        return new SpatialRuntimeVO(layoutId, layout.getPublishedVersionId(), LocalDateTime.now(), elements, false);
    }

    @Transactional(readOnly = true)
    public List<SpatialLocateVO> locateByCi(Long ciId, String tenantId) {
        if (ciId == null || ciId <= 0) throw BusinessException.badRequest("SPATIAL_CI_ID_INVALID", "CI 标识无效");
        return runtimeMapper.locateByCi(ciId, tenantId).stream().map(this::toLocate).toList();
    }

    @Transactional(readOnly = true)
    public List<SpatialLocateVO> locate(String keyword, int size, String tenantId) {
        if (keyword == null || keyword.isBlank()) throw BusinessException.badRequest("SPATIAL_LOCATE_KEYWORD_REQUIRED", "请输入搜索关键词");
        if (size < 1 || size > 100) throw BusinessException.badRequest("SPATIAL_PAGE_INVALID", "查询数量必须在 1 到 100 之间");
        return runtimeMapper.locateByKeyword(keyword.trim(), tenantId, size).stream().map(this::toLocate).toList();
    }

    private List<SpatialCandidateVO> candidates(List<Map<String, Object>> rows) {
        return rows.stream().map(row -> new SpatialCandidateVO(longValue(row, "ciInstanceId"), stringValue(row, "name"),
                stringValue(row, "modelId"), stringValue(row, "status"), booleanValue(row, "bound"))).toList();
    }
    private SpatialLocateVO toLocate(Map<String, Object> row) {
        String room = stringValue(row, "roomName"), rack = stringValue(row, "rackName"), target = stringValue(row, "targetCiName");
        String path = room + " > " + rack + (target != null && !target.equals(rack) ? " > " + target : "");
        return new SpatialLocateVO(longValue(row, "roomInstanceId"), room, longValue(row, "layoutId"), longValue(row, "publishedVersionId"),
                stringValue(row, "elementId"), longValue(row, "targetCiInstanceId"), target, stringValue(row, "targetModelId"),
                longValue(row, "rackCiInstanceId"), rack, path);
    }
    private SpatialLayout requireLayout(Long layoutId, String tenantId) {
        SpatialLayout layout = layoutMapper.selectById(layoutId);
        if (layout == null || Boolean.TRUE.equals(layout.getIsDeleted()) || !tenantId.equals(layout.getTenantId())) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "SPATIAL_LAYOUT_NOT_FOUND", "空间布局不存在");
        }
        return layout;
    }
    private void requirePage(int page, int size) { if (page < 1 || size < 1 || size > 200) throw BusinessException.badRequest("SPATIAL_PAGE_INVALID", "分页参数无效"); }
    private String safe(String value) { return value == null ? "" : value.trim(); }
    private Long longValue(Map<String, Object> row, String key) { Object value = row.get(key); return value instanceof Number n ? n.longValue() : value == null ? null : Long.valueOf(value.toString()); }
    private int intValue(Map<String, Object> row, String key, int fallback) { Object value = row.get(key); return value instanceof Number n ? n.intValue() : value == null ? fallback : Integer.parseInt(value.toString()); }
    private boolean booleanValue(Map<String, Object> row, String key) { Object value = row.get(key); return value instanceof Boolean b ? b : value != null && Boolean.parseBoolean(value.toString()); }
    private String stringValue(Map<String, Object> row, String key) { Object value = row.get(key); return value == null ? null : value.toString(); }
}
