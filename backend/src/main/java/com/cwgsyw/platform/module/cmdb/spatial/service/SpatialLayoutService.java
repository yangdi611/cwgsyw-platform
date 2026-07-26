package com.cwgsyw.platform.module.cmdb.spatial.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.spatial.document.SpatialDocumentValidation;
import com.cwgsyw.platform.module.cmdb.spatial.document.SpatialDocumentValidator;
import com.cwgsyw.platform.module.cmdb.spatial.dto.*;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialBinding;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialLayout;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialLayoutVersion;
import com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialVersionAsset;
import com.cwgsyw.platform.module.cmdb.spatial.mapper.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Lifecycle service for independent spatial layouts. Existing CMDB data is read-only here. */
@Service
@RequiredArgsConstructor
public class SpatialLayoutService {
    private static final String ACTIVE = "ACTIVE";
    private static final String ARCHIVED = "ARCHIVED";
    private static final String DRAFT = "DRAFT";
    private static final String PUBLISHED = "PUBLISHED";

    private final SpatialLayoutMapper layoutMapper;
    private final SpatialLayoutVersionMapper versionMapper;
    private final SpatialBindingMapper bindingMapper;
    private final SpatialAssetMapper assetMapper;
    private final SpatialVersionAssetMapper versionAssetMapper;
    private final SpatialCmdbReadMapper cmdbReadMapper;
    private final SpatialDocumentValidator documentValidator;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    @Transactional
    public SpatialLayoutVO create(SpatialCreateLayoutRequest request, String tenantId, Long operatorId) {
        CiInstance room = requireRoom(request.getRoomInstanceId(), tenantId);
        SpatialLayout existing = layoutMapper.selectOne(new LambdaQueryWrapper<SpatialLayout>()
                .eq(SpatialLayout::getTenantId, tenantId)
                .eq(SpatialLayout::getRoomInstanceId, room.getId())
                .eq(SpatialLayout::getStatus, ACTIVE)
                .eq(SpatialLayout::getIsDeleted, false)
                .last("LIMIT 1"));
        if (existing != null) throw conflict("SPATIAL_LAYOUT_ROOM_EXISTS", "该机房已经存在空间布局");

        SpatialLayout layout = new SpatialLayout();
        layout.setTenantId(tenantId);
        layout.setRoomInstanceId(room.getId());
        layout.setName(request.getName().trim());
        layout.setStatus(ACTIVE);
        layout.setCreatedBy(operatorId);
        layout.setUpdatedBy(operatorId);
        layout.setCreatedAt(LocalDateTime.now());
        layout.setUpdatedAt(LocalDateTime.now());
        layoutMapper.insert(layout);

        SpatialLayoutVersion draft = newDraft(layout.getId(), tenantId, null, emptyDocument(), operatorId);
        versionMapper.insert(draft);
        rebuildVersionAssets(draft, tenantId, operatorId);
        layout.setDraftVersionId(draft.getId());
        layoutMapper.updateById(layout);
        audit(tenantId, "create_layout", layout.getId(), operatorId, null, snapshot(layout));
        return toLayoutVO(layout);
    }

    @Transactional(readOnly = true)
    public List<SpatialLayoutVO> list(String tenantId, boolean includeArchived) {
        LambdaQueryWrapper<SpatialLayout> query = new LambdaQueryWrapper<SpatialLayout>()
                .eq(SpatialLayout::getTenantId, tenantId)
                .eq(SpatialLayout::getIsDeleted, false)
                .orderByDesc(SpatialLayout::getUpdatedAt);
        if (!includeArchived) query.eq(SpatialLayout::getStatus, ACTIVE);
        return layoutMapper.selectList(query).stream().map(this::toLayoutVO).toList();
    }

    @Transactional(readOnly = true)
    public SpatialLayoutVersionVO getDraft(Long layoutId, String tenantId) {
        SpatialLayout layout = requireLayout(layoutId, tenantId);
        if (layout.getDraftVersionId() == null) throw notFound("SPATIAL_DRAFT_NOT_FOUND", "布局草稿不存在");
        return toVersionVO(requireVersion(layout.getDraftVersionId(), layoutId, tenantId));
    }

    @Transactional(readOnly = true)
    public SpatialLayoutVersionVO getPublishedByRoom(Long roomInstanceId, String tenantId) {
        SpatialLayout layout = layoutMapper.selectOne(new LambdaQueryWrapper<SpatialLayout>()
                .eq(SpatialLayout::getTenantId, tenantId)
                .eq(SpatialLayout::getRoomInstanceId, roomInstanceId)
                .eq(SpatialLayout::getStatus, ACTIVE)
                .eq(SpatialLayout::getIsDeleted, false)
                .last("LIMIT 1"));
        if (layout == null || layout.getPublishedVersionId() == null) throw notFound("SPATIAL_PUBLISHED_NOT_FOUND", "该机房尚未发布空间布局");
        return toVersionVO(requireVersion(layout.getPublishedVersionId(), layout.getId(), tenantId));
    }

    @Transactional(readOnly = true)
    public List<SpatialLayoutVersionVO> listVersions(Long layoutId, String tenantId) {
        requireLayout(layoutId, tenantId);
        return versionMapper.selectList(new LambdaQueryWrapper<SpatialLayoutVersion>()
                        .eq(SpatialLayoutVersion::getTenantId, tenantId)
                        .eq(SpatialLayoutVersion::getLayoutId, layoutId)
                        .eq(SpatialLayoutVersion::getState, PUBLISHED)
                        .orderByDesc(SpatialLayoutVersion::getVersionNo))
                .stream().map(this::toVersionVO).toList();
    }

    @Transactional(readOnly = true)
    public SpatialLayoutVersionVO getPublishedVersion(Long layoutId, Long versionId, String tenantId) {
        SpatialLayoutVersion version = requireVersion(versionId, layoutId, tenantId);
        if (!PUBLISHED.equals(version.getState())) throw notFound("SPATIAL_VERSION_NOT_FOUND", "布局版本不存在");
        return toVersionVO(version);
    }

    @Transactional
    public SpatialLayoutVersionVO saveDraft(Long layoutId, SpatialSaveDraftRequest request, String tenantId, Long operatorId) {
        SpatialLayout layout = lockLayout(layoutId, tenantId);
        SpatialLayoutVersion draft = lockDraft(layout, tenantId);
        if (!Objects.equals(draft.getRevision(), request.getRevision())) {
            throw conflict("SPATIAL_DRAFT_CONFLICT", "布局草稿已被其他操作更新，请重新加载");
        }
        validateDraftPayload(request);
        String checksum = checksum(request.getDocument());
        int count = request.getDocument().path("elements").isArray() ? request.getDocument().path("elements").size() : 0;
        int updated = versionMapper.updateDraftDocument(draft.getId(), tenantId, request.getRevision(),
                request.getSchemaVersion(), request.getDocument(), checksum, count, operatorId, LocalDateTime.now());
        if (updated != 1) throw conflict("SPATIAL_DRAFT_CONFLICT", "布局草稿已被其他操作更新，请重新加载");
        draft = requireVersion(draft.getId(), layoutId, tenantId);
        rebuildBindings(layout, draft, tenantId, operatorId, false);
        rebuildVersionAssets(draft, tenantId, operatorId);
        audit(tenantId, "save_draft", layoutId, operatorId, null, "{\"revision\":" + draft.getRevision() + "}");
        return toVersionVO(draft);
    }

    @Transactional(readOnly = true)
    public SpatialValidationResult validateDraft(Long layoutId, String tenantId) {
        SpatialLayout layout = requireLayout(layoutId, tenantId);
        SpatialLayoutVersion draft = requireDraft(layout, tenantId);
        SpatialDocumentValidation structural = documentValidator.validate(draft.getDocument());
        List<SpatialValidationIssue> errors = new ArrayList<>(structural.errors());
        List<SpatialValidationIssue> warnings = new ArrayList<>(structural.warnings());
        validateBindings(layout, draft, tenantId, errors);
        return new SpatialValidationResult(draft.getRevision(), errors.isEmpty(), errors, warnings);
    }

    @Transactional
    public SpatialLayoutVersionVO publish(Long layoutId, SpatialPublishRequest request, String tenantId, Long operatorId) {
        SpatialLayout layout = lockLayout(layoutId, tenantId);
        if (ARCHIVED.equals(layout.getStatus())) throw conflict("SPATIAL_LAYOUT_ARCHIVED", "已归档布局不能发布");
        SpatialLayoutVersion draft = lockDraft(layout, tenantId);
        if (!Objects.equals(draft.getRevision(), request.getRevision())) {
            throw conflict("SPATIAL_DRAFT_CONFLICT", "布局草稿已被其他操作更新，请重新加载");
        }
        SpatialValidationResult validation = validationFor(layout, draft, tenantId);
        if (!validation.valid()) throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SPATIAL_PUBLISH_INVALID", "布局存在阻断性校验错误");
        int nextVersionNo = versionMapper.maxPublishedVersionNo(layoutId, tenantId) + 1;
        LocalDateTime now = LocalDateTime.now();
        draft.setState(PUBLISHED);
        draft.setVersionNo(nextVersionNo);
        draft.setChangeSummary(request.getChangeSummary());
        draft.setPublishedAt(now);
        draft.setPublishedBy(operatorId);
        draft.setUpdatedAt(now);
        draft.setUpdatedBy(operatorId);
        versionMapper.updateById(draft);
        rebuildBindings(layout, draft, tenantId, operatorId, true);
        rebuildVersionAssets(draft, tenantId, operatorId);

        SpatialLayoutVersion nextDraft = newDraft(layoutId, tenantId, draft.getId(), draft.getDocument(), operatorId);
        versionMapper.insert(nextDraft);
        rebuildBindings(layout, nextDraft, tenantId, operatorId, false);
        rebuildVersionAssets(nextDraft, tenantId, operatorId);
        layout.setPublishedVersionId(draft.getId());
        layout.setDraftVersionId(nextDraft.getId());
        layout.setUpdatedBy(operatorId);
        layoutMapper.updateById(layout);
        audit(tenantId, "publish_layout", layoutId, operatorId, null,
                "{\"versionNo\":" + nextVersionNo + ",\"warnings\":" + validation.warnings().size() + "}");
        return toVersionVO(draft);
    }

    @Transactional
    public SpatialLayoutVersionVO restoreVersion(Long layoutId, Long versionId, String tenantId, Long operatorId) {
        SpatialLayout layout = lockLayout(layoutId, tenantId);
        SpatialLayoutVersion source = requireVersion(versionId, layoutId, tenantId);
        if (!PUBLISHED.equals(source.getState())) throw notFound("SPATIAL_VERSION_NOT_FOUND", "布局版本不存在");
        SpatialLayoutVersion draft = lockDraft(layout, tenantId);
        if (draft.getRevision() > 0 || !sameJson(draft.getDocument(), source.getDocument())) {
            throw conflict("SPATIAL_DRAFT_EXISTS", "当前存在未确认草稿，不能覆盖恢复");
        }
        // The layout points at its draft through a foreign key. Clear that pointer before
        // replacing the untouched draft, then install the restored draft atomically.
        layoutMapper.clearDraftVersion(layoutId, tenantId, operatorId);
        bindingMapper.deleteByVersion(draft.getId(), tenantId);
        versionMapper.deleteById(draft.getId());
        SpatialLayoutVersion restored = newDraft(layoutId, tenantId, source.getId(), source.getDocument(), operatorId);
        versionMapper.insert(restored);
        layout.setDraftVersionId(restored.getId());
        layoutMapper.updateById(layout);
        rebuildBindings(layout, restored, tenantId, operatorId, false);
        rebuildVersionAssets(restored, tenantId, operatorId);
        audit(tenantId, "restore_layout_version", layoutId, operatorId, null, "{\"sourceVersionId\":" + versionId + "}");
        return toVersionVO(restored);
    }

    @Transactional
    public void archive(Long layoutId, String tenantId, Long operatorId) {
        SpatialLayout layout = lockLayout(layoutId, tenantId);
        if (ARCHIVED.equals(layout.getStatus())) return;
        layout.setStatus(ARCHIVED);
        layout.setUpdatedBy(operatorId);
        layoutMapper.updateById(layout);
        audit(tenantId, "archive_layout", layoutId, operatorId, snapshot(layout), null);
    }

    @Transactional
    public void restoreActive(Long layoutId, String tenantId, Long operatorId) {
        SpatialLayout layout = lockLayout(layoutId, tenantId);
        if (ACTIVE.equals(layout.getStatus())) return;
        SpatialLayout active = layoutMapper.selectOne(new LambdaQueryWrapper<SpatialLayout>()
                .eq(SpatialLayout::getTenantId, tenantId)
                .eq(SpatialLayout::getRoomInstanceId, layout.getRoomInstanceId())
                .eq(SpatialLayout::getStatus, ACTIVE)
                .eq(SpatialLayout::getIsDeleted, false)
                .ne(SpatialLayout::getId, layoutId)
                .last("LIMIT 1"));
        if (active != null) {
            throw conflict("SPATIAL_LAYOUT_ROOM_ACTIVE_EXISTS", "该机房已有活动空间布局，无法恢复归档布局");
        }
        layout.setStatus(ACTIVE);
        layout.setUpdatedBy(operatorId);
        layoutMapper.updateById(layout);
        audit(tenantId, "restore_active_layout", layoutId, operatorId, null, snapshot(layout));
    }

    @Transactional
    public void deleteEmpty(Long layoutId, String tenantId, Long operatorId) {
        SpatialLayout layout = lockLayout(layoutId, tenantId);
        if (layout.getPublishedVersionId() != null) throw conflict("SPATIAL_LAYOUT_PUBLISHED", "已发布布局只能归档，不能删除");
        SpatialLayoutVersion draft = requireDraft(layout, tenantId);
        if (draft.getElementCount() != 0 || assetMapper.selectCount(new LambdaQueryWrapper<com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialAsset>()
                .eq(com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialAsset::getTenantId, tenantId)
                .eq(com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialAsset::getLayoutId, layoutId)
                .eq(com.cwgsyw.platform.module.cmdb.spatial.entity.SpatialAsset::getIsDeleted, false)) > 0) {
            throw conflict("SPATIAL_LAYOUT_NOT_EMPTY", "布局包含草稿内容或参考图，不能删除");
        }
        bindingMapper.deleteByVersion(draft.getId(), tenantId);
        versionMapper.deleteById(draft.getId());
        layout.setDeletedBy(operatorId);
        layout.setDeletedAt(LocalDateTime.now());
        layoutMapper.updateById(layout);
        layoutMapper.deleteById(layoutId);
        audit(tenantId, "delete_layout", layoutId, operatorId, snapshot(layout), null);
    }

    private SpatialValidationResult validationFor(SpatialLayout layout, SpatialLayoutVersion draft, String tenantId) {
        SpatialDocumentValidation structural = documentValidator.validate(draft.getDocument());
        List<SpatialValidationIssue> errors = new ArrayList<>(structural.errors());
        List<SpatialValidationIssue> warnings = new ArrayList<>(structural.warnings());
        validateBindings(layout, draft, tenantId, errors);
        return new SpatialValidationResult(draft.getRevision(), errors.isEmpty(), errors, warnings);
    }

    private void validateDraftPayload(SpatialSaveDraftRequest request) {
        if (request.getSchemaVersion() != SpatialDocumentValidator.SCHEMA_VERSION || request.getDocument().path("schemaVersion").asInt(-1) != request.getSchemaVersion()) {
            throw BusinessException.badRequest("SPATIAL_SCHEMA_VERSION_INVALID", "布局文档版本不匹配或不受支持");
        }
        if (!request.getDocument().isObject() || !request.getDocument().path("elements").isArray() || request.getDocument().path("elements").size() > SpatialDocumentValidator.MAX_ELEMENTS) {
            throw BusinessException.badRequest("SPATIAL_DOCUMENT_INVALID", "布局文档结构无效或元素数量超限");
        }
    }

    private void validateBindings(SpatialLayout layout, SpatialLayoutVersion version, String tenantId, List<SpatialValidationIssue> errors) {
        Set<Long> boundCiIds = new HashSet<>();
        JsonNode elements = version.getDocument().path("elements");
        for (int i = 0; i < elements.size(); i++) {
            JsonNode element = elements.get(i);
            Long ciId = element.path("binding").hasNonNull("ciInstanceId") ? element.path("binding").path("ciInstanceId").asLong() : null;
            if (ciId == null || ciId <= 0) continue;
            String type = element.path("type").asText();
            String id = element.path("id").asText(null);
            if (!("RACK_SLOT".equals(type) || "FACILITY".equals(type))) {
                errors.add(issue("BINDING_ELEMENT_INVALID", id, "elements[" + i + "].binding", "仅机柜位或设施可绑定 CI"));
                continue;
            }
            if (!boundCiIds.add(ciId)) errors.add(issue("CI_BINDING_DUPLICATE", id, "elements[" + i + "].binding.ciInstanceId", "同一 CI 不能重复绑定"));
            CiInstance ci = cmdbReadMapper.findActiveInstance(ciId, tenantId);
            if (ci == null) {
                errors.add(issue("CI_BINDING_NOT_FOUND", id, "elements[" + i + "].binding.ciInstanceId", "绑定 CI 不存在或不可用"));
            } else if ("RACK_SLOT".equals(type) && !"rack".equals(ci.getModelId())) {
                errors.add(issue("RACK_BINDING_MODEL_INVALID", id, "elements[" + i + "].binding.ciInstanceId", "机柜位只能绑定机柜模型"));
            } else if ("RACK_SLOT".equals(type) && !cmdbReadMapper.roomContainsRack(layout.getRoomInstanceId(), ciId, tenantId)) {
                errors.add(issue("RACK_ROOM_RELATION_MISSING", id, "elements[" + i + "].binding.ciInstanceId", "机柜尚未与当前机房建立包含关系"));
            } else if ("FACILITY".equals(type) && Objects.equals(ciId, layout.getRoomInstanceId())) {
                errors.add(issue("FACILITY_BINDING_INVALID", id, "elements[" + i + "].binding.ciInstanceId", "设施不能绑定当前机房自身"));
            }
        }
    }

    private void rebuildBindings(SpatialLayout layout, SpatialLayoutVersion version, String tenantId, Long operatorId, boolean requireValid) {
        SpatialValidationResult validation = validationFor(layout, version, tenantId);
        if (requireValid && !validation.valid()) throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "SPATIAL_BINDING_INVALID", "布局绑定校验失败");
        bindingMapper.deleteByVersion(version.getId(), tenantId);
        if (!validation.valid()) return;
        for (JsonNode element : version.getDocument().path("elements")) {
            if (!element.path("binding").hasNonNull("ciInstanceId")) continue;
            String type = element.path("type").asText();
            if (!("RACK_SLOT".equals(type) || "FACILITY".equals(type))) continue;
            Long ciId = element.path("binding").path("ciInstanceId").asLong();
            CiInstance ci = cmdbReadMapper.findActiveInstance(ciId, tenantId);
            if (ci == null) continue;
            SpatialBinding binding = new SpatialBinding();
            binding.setTenantId(tenantId);
            binding.setLayoutId(layout.getId());
            binding.setLayoutVersionId(version.getId());
            binding.setRoomInstanceId(layout.getRoomInstanceId());
            binding.setElementId(element.path("id").asText());
            binding.setElementType(type);
            binding.setCiInstanceId(ciId);
            binding.setCiModelIdSnapshot(ci.getModelId());
            binding.setDisplayNameSnapshot(ci.getName());
            binding.setCreatedBy(operatorId);
            binding.setCreatedAt(LocalDateTime.now());
            bindingMapper.insert(binding);
        }
    }

    /** The document's reference asset is projected so every draft and published snapshot protects it from deletion. */
    private void rebuildVersionAssets(SpatialLayoutVersion version, String tenantId, Long operatorId) {
        versionAssetMapper.delete(new LambdaQueryWrapper<SpatialVersionAsset>()
                .eq(SpatialVersionAsset::getLayoutVersionId, version.getId())
                .eq(SpatialVersionAsset::getTenantId, tenantId));
        JsonNode assetIdNode = version.getDocument().path("reference").path("assetId");
        if (!assetIdNode.canConvertToLong() || assetIdNode.asLong() <= 0) return;
        long assetId = assetIdNode.asLong();
        var asset = assetMapper.selectById(assetId);
        if (asset == null || Boolean.TRUE.equals(asset.getIsDeleted()) || !tenantId.equals(asset.getTenantId()) || !version.getLayoutId().equals(asset.getLayoutId())) {
            throw BusinessException.badRequest("SPATIAL_REFERENCE_ASSET_INVALID", "参考图不存在、不可用或不属于当前布局");
        }
        SpatialVersionAsset link = new SpatialVersionAsset();
        link.setTenantId(tenantId);
        link.setLayoutVersionId(version.getId());
        link.setAssetId(assetId);
        link.setUsage("REFERENCE_BACKGROUND");
        link.setCreatedBy(operatorId);
        link.setCreatedAt(LocalDateTime.now());
        versionAssetMapper.insert(link);
    }

    private SpatialLayout lockLayout(Long layoutId, String tenantId) {
        SpatialLayout layout = layoutMapper.findActiveForUpdate(layoutId, tenantId);
        if (layout == null) throw notFound("SPATIAL_LAYOUT_NOT_FOUND", "空间布局不存在");
        return layout;
    }
    private SpatialLayout requireLayout(Long layoutId, String tenantId) {
        SpatialLayout layout = layoutMapper.selectById(layoutId);
        if (layout == null || Boolean.TRUE.equals(layout.getIsDeleted()) || !tenantId.equals(layout.getTenantId())) throw notFound("SPATIAL_LAYOUT_NOT_FOUND", "空间布局不存在");
        return layout;
    }
    private SpatialLayoutVersion lockDraft(SpatialLayout layout, String tenantId) {
        Long draftId = versionMapper.lockDraftId(layout.getId(), tenantId);
        if (draftId == null) throw notFound("SPATIAL_DRAFT_NOT_FOUND", "布局草稿不存在");
        return requireVersion(draftId, layout.getId(), tenantId);
    }
    private SpatialLayoutVersion requireDraft(SpatialLayout layout, String tenantId) {
        if (layout.getDraftVersionId() == null) throw notFound("SPATIAL_DRAFT_NOT_FOUND", "布局草稿不存在");
        return requireVersion(layout.getDraftVersionId(), layout.getId(), tenantId);
    }
    private SpatialLayoutVersion requireVersion(Long versionId, Long layoutId, String tenantId) {
        SpatialLayoutVersion version = versionMapper.selectById(versionId);
        if (version == null || !tenantId.equals(version.getTenantId()) || !layoutId.equals(version.getLayoutId())) throw notFound("SPATIAL_VERSION_NOT_FOUND", "布局版本不存在");
        return version;
    }
    private CiInstance requireRoom(Long roomId, String tenantId) {
        CiInstance room = cmdbReadMapper.findActiveInstance(roomId, tenantId);
        if (room == null || !"idc_room".equals(room.getModelId())) throw new BusinessException(HttpStatus.NOT_FOUND, "SPATIAL_ROOM_NOT_FOUND", "机房不存在或不可用");
        return room;
    }
    private SpatialLayoutVersion newDraft(Long layoutId, String tenantId, Long sourceVersionId, JsonNode document, Long operatorId) {
        SpatialLayoutVersion version = new SpatialLayoutVersion();
        version.setTenantId(tenantId);
        version.setLayoutId(layoutId);
        version.setState(DRAFT);
        version.setRevision(0);
        version.setSchemaVersion(SpatialDocumentValidator.SCHEMA_VERSION);
        version.setDocument(document.deepCopy());
        version.setDocumentChecksum(checksum(document));
        version.setElementCount(document.path("elements").size());
        version.setSourceVersionId(sourceVersionId);
        version.setCreatedBy(operatorId);
        version.setUpdatedBy(operatorId);
        version.setCreatedAt(LocalDateTime.now());
        version.setUpdatedAt(LocalDateTime.now());
        return version;
    }
    private JsonNode emptyDocument() {
        ObjectNode document = objectMapper.createObjectNode();
        document.put("schemaVersion", SpatialDocumentValidator.SCHEMA_VERSION);
        ObjectNode canvas = document.putObject("canvas");
        canvas.put("logicalWidth", 1600); canvas.put("logicalHeight", 1000); canvas.put("gridSize", 10);
        document.putArray("elements");
        document.putObject("extensions");
        return document;
    }
    private String checksum(JsonNode document) {
        try {
            JsonNode canonical = canonicalize(document);
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(objectMapper.writeValueAsBytes(canonical));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (Exception ex) { throw new IllegalStateException("无法计算布局文档校验和", ex); }
    }
    private JsonNode canonicalize(JsonNode value) {
        if (value.isObject()) {
            ObjectNode result = objectMapper.createObjectNode();
            List<String> names = new ArrayList<>(); value.fieldNames().forEachRemaining(names::add); Collections.sort(names);
            for (String name : names) result.set(name, canonicalize(value.get(name)));
            return result;
        }
        if (value.isArray()) { var result = objectMapper.createArrayNode(); for (JsonNode node : value) result.add(canonicalize(node)); return result; }
        return value;
    }
    private boolean sameJson(JsonNode left, JsonNode right) { return checksum(left).equals(checksum(right)); }
    private SpatialLayoutVO toLayoutVO(SpatialLayout layout) { return new SpatialLayoutVO(layout.getId(), layout.getRoomInstanceId(), layout.getName(), layout.getStatus(), layout.getDraftVersionId(), layout.getPublishedVersionId(), layout.getUpdatedAt()); }
    private SpatialLayoutVersionVO toVersionVO(SpatialLayoutVersion version) { return new SpatialLayoutVersionVO(version.getId(), version.getLayoutId(), version.getState(), version.getVersionNo(), version.getRevision(), version.getSchemaVersion(), version.getDocument(), version.getDocumentChecksum(), version.getElementCount(), version.getSourceVersionId(), version.getChangeSummary(), version.getPublishedAt(), version.getUpdatedAt()); }
    private SpatialValidationIssue issue(String code, String elementId, String path, String message) { return new SpatialValidationIssue(code, elementId, path, message); }
    private BusinessException notFound(String code, String message) { return new BusinessException(HttpStatus.NOT_FOUND, code, message); }
    private BusinessException conflict(String code, String message) { return new BusinessException(HttpStatus.CONFLICT, code, message); }
    private void audit(String tenantId, String action, Long targetId, Long operatorId, String before, String after) { auditLogMapper.insert(AuditLog.builder().tenantId(tenantId).module("cmdb_spatial").action(action).targetId(targetId).targetType("ci_spatial_layout").operatorId(operatorId == null ? 0L : operatorId).beforeJson(before).afterJson(after).createdAt(LocalDateTime.now()).build()); }
    private String snapshot(SpatialLayout layout) { return "{\"id\":" + layout.getId() + ",\"roomInstanceId\":" + layout.getRoomInstanceId() + ",\"status\":\"" + layout.getStatus() + "\"}"; }
}
