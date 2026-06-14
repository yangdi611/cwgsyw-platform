package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.changedoc.dto.LinkCiRequest;
import com.cwgsyw.platform.module.changedoc.dto.LinkedChangeDocVO;
import com.cwgsyw.platform.module.changedoc.dto.LinkedCiInstanceVO;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Manages the association between change documents and CI instances
 * (the change_doc_ci_link table).
 *
 * <p>Uses {@link CiInstanceMapper} directly (not {@code CiInstanceService}) to
 * avoid a circular dependency — this service is itself injected into services
 * that {@code CiInstanceService} may depend on.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChangeDocLinkService {

    private final ChangeDocCiLinkMapper changeDocCiLinkMapper;
    private final ChangeDocMapper changeDocMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final CiModelMapper ciModelMapper;
    private final UserMapper userMapper;
    private final AuditLogMapper auditLogMapper;

    // ─── Write operations ─────────────────────────────────────────────────────

    /**
     * Link one or more CI instances to a change document. Existing (non-deleted)
     * links are skipped so the caller can re-submit the full desired set safely.
     *
     * @return number of links actually created
     */
    @Transactional
    public int linkCiInstances(String tenantId, Long changeDocId, Long operatorId, LinkCiRequest req) {
        loadChangeDoc(tenantId, changeDocId);
        if (req == null || req.getLinks() == null || req.getLinks().isEmpty()) {
            return 0;
        }

        int inserted = 0;
        List<Long> linkedInstanceIds = new ArrayList<>();
        for (LinkCiRequest.LinkItem item : req.getLinks()) {
            if (item.getInstanceId() == null) continue;

            // Validate instance exists and belongs to tenant
            CiInstance inst = ciInstanceMapper.selectById(item.getInstanceId());
            if (inst == null || !tenantId.equals(inst.getTenantId())
                    || Boolean.TRUE.equals(inst.getIsDeleted())) {
                throw new IllegalArgumentException("CI 实例不存在: " + item.getInstanceId());
            }

            // Skip if a non-deleted link already exists
            long existing = changeDocCiLinkMapper.selectCount(
                    new LambdaQueryWrapper<ChangeDocCiLink>()
                            .eq(ChangeDocCiLink::getTenantId, tenantId)
                            .eq(ChangeDocCiLink::getChangeDocId, changeDocId)
                            .eq(ChangeDocCiLink::getInstanceId, item.getInstanceId())
                            .eq(ChangeDocCiLink::getIsDeleted, false));
            if (existing > 0) continue;

            ChangeDocCiLink link = new ChangeDocCiLink();
            link.setTenantId(tenantId);
            link.setChangeDocId(changeDocId);
            link.setInstanceId(item.getInstanceId());
            link.setImpactLevel(item.getImpactLevel());
            link.setCreatedBy(operatorId);
            link.setCreatedAt(LocalDateTime.now());
            link.setUpdatedAt(LocalDateTime.now());
            changeDocCiLinkMapper.insert(link);

            linkedInstanceIds.add(item.getInstanceId());
            inserted++;
        }

        if (inserted > 0) {
            writeAudit(tenantId, "link_ci", changeDocId, operatorId,
                    "关联 " + inserted + " 个 CI 实例: " + linkedInstanceIds);
        }
        return inserted;
    }

    /**
     * Soft-delete a single CI link from a change document.
     */
    @Transactional
    public void unlinkCiInstance(String tenantId, Long changeDocId, Long instanceId, Long operatorId) {
        loadChangeDoc(tenantId, changeDocId);

        ChangeDocCiLink link = changeDocCiLinkMapper.selectOne(
                new LambdaQueryWrapper<ChangeDocCiLink>()
                        .eq(ChangeDocCiLink::getTenantId, tenantId)
                        .eq(ChangeDocCiLink::getChangeDocId, changeDocId)
                        .eq(ChangeDocCiLink::getInstanceId, instanceId)
                        .eq(ChangeDocCiLink::getIsDeleted, false));
        if (link == null) {
            throw new IllegalArgumentException("关联不存在");
        }

        link.setIsDeleted(true);
        link.setDeletedAt(LocalDateTime.now());
        link.setDeletedBy(operatorId);
        link.setUpdatedAt(LocalDateTime.now());
        changeDocCiLinkMapper.updateById(link);

        writeAudit(tenantId, "unlink_ci", changeDocId, operatorId,
                "取消关联 CI 实例: " + instanceId);
    }

    // ─── Read operations ──────────────────────────────────────────────────────

    /**
     * List CI instances linked to a change document, newest links first.
     */
    public List<LinkedCiInstanceVO> listLinkedInstances(Long changeDocId, String tenantId) {
        List<ChangeDocCiLink> links = changeDocCiLinkMapper.selectList(
                new LambdaQueryWrapper<ChangeDocCiLink>()
                        .eq(ChangeDocCiLink::getTenantId, tenantId)
                        .eq(ChangeDocCiLink::getChangeDocId, changeDocId)
                        .eq(ChangeDocCiLink::getIsDeleted, false)
                        .orderByDesc(ChangeDocCiLink::getCreatedAt));
        if (links.isEmpty()) return List.of();

        List<Long> instanceIds = links.stream()
                .map(ChangeDocCiLink::getInstanceId).distinct().collect(Collectors.toList());
        Map<Long, CiInstance> instanceMap = ciInstanceMapper.selectBatchIds(instanceIds).stream()
                .collect(Collectors.toMap(CiInstance::getId, i -> i, (a, b) -> a));

        Map<String, String> modelNames = resolveModelNames(instanceMap.values(), tenantId);

        return links.stream().map(link -> {
            CiInstance inst = instanceMap.get(link.getInstanceId());
            LinkedCiInstanceVO vo = new LinkedCiInstanceVO();
            if (inst != null) {
                vo.setId(inst.getId());
                vo.setName(inst.getName());
                vo.setModelId(inst.getModelId());
                vo.setModelName(modelNames.getOrDefault(inst.getModelId(), inst.getModelId()));
                vo.setOwner(inst.getOwner());
                vo.setStatus(inst.getStatus());
            } else {
                // Instance was hard-removed or tenant-mismatched; keep id for traceability
                vo.setId(link.getInstanceId());
            }
            vo.setImpactLevel(link.getImpactLevel());
            vo.setLinkCreatedAt(link.getCreatedAt());
            return vo;
        }).collect(Collectors.toList());
    }

    /**
     * List change documents linked to a CI instance, newest links first.
     */
    public List<LinkedChangeDocVO> listLinkedChangeDocs(Long instanceId, String tenantId) {
        List<ChangeDocCiLink> links = changeDocCiLinkMapper.selectList(
                new LambdaQueryWrapper<ChangeDocCiLink>()
                        .eq(ChangeDocCiLink::getTenantId, tenantId)
                        .eq(ChangeDocCiLink::getInstanceId, instanceId)
                        .eq(ChangeDocCiLink::getIsDeleted, false)
                        .orderByDesc(ChangeDocCiLink::getCreatedAt));
        if (links.isEmpty()) return List.of();

        List<Long> docIds = links.stream()
                .map(ChangeDocCiLink::getChangeDocId).distinct().collect(Collectors.toList());
        Map<Long, ChangeDoc> docMap = changeDocMapper.selectBatchIds(docIds).stream()
                .filter(d -> tenantId.equals(d.getTenantId()) && !Boolean.TRUE.equals(d.getIsDeleted()))
                .collect(Collectors.toMap(ChangeDoc::getId, d -> d, (a, b) -> a));

        Map<Long, String> applicantNames = resolveUserNames(docMap.values().stream()
                .map(ChangeDoc::getApplicantId).filter(Objects::nonNull).collect(Collectors.toSet()));

        Map<Long, ChangeDocCiLink> linkByDocId = links.stream()
                .collect(Collectors.toMap(ChangeDocCiLink::getChangeDocId, l -> l, (a, b) -> a));

        return docMap.values().stream().map(doc -> {
            ChangeDocCiLink link = linkByDocId.get(doc.getId());
            LinkedChangeDocVO vo = new LinkedChangeDocVO();
            vo.setId(doc.getId());
            vo.setChangeNo(doc.getChangeNo());
            vo.setTitle(doc.getTitle());
            vo.setStatus(doc.getStatus());
            vo.setApplicantId(doc.getApplicantId());
            vo.setApplicantName(applicantNames.get(doc.getApplicantId()));
            vo.setImpactLevel(link != null ? link.getImpactLevel() : null);
            vo.setLinkCreatedAt(link != null ? link.getCreatedAt() : null);
            return vo;
        }).collect(Collectors.toList());
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private ChangeDoc loadChangeDoc(String tenantId, Long changeDocId) {
        ChangeDoc doc = changeDocMapper.selectById(changeDocId);
        if (doc == null || !tenantId.equals(doc.getTenantId()) || Boolean.TRUE.equals(doc.getIsDeleted())) {
            throw new IllegalArgumentException("变更文档不存在");
        }
        return doc;
    }

    private Map<String, String> resolveModelNames(Collection<CiInstance> instances, String tenantId) {
        Map<String, String> modelNames = new HashMap<>();
        for (CiInstance inst : instances) {
            if (inst.getModelId() == null || modelNames.containsKey(inst.getModelId())) continue;
            ciModelMapper.findByName(inst.getModelId(), tenantId)
                    .ifPresent(m -> modelNames.put(m.getName(), m.getDisplayName()));
        }
        return modelNames;
    }

    private Map<Long, String> resolveUserNames(Set<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId,
                        u -> u.getRealName() != null ? u.getRealName() : u.getUsername(), (a, b) -> a));
    }

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId)
                .module("change_doc")
                .action(action)
                .targetId(targetId)
                .targetType("ChangeDoc")
                .operatorId(operatorId != null ? operatorId : 0L)
                .remark(remark)
                .createdAt(LocalDateTime.now())
                .build());
    }
}
