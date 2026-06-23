package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.ai.AiGatewayService;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocSnapshot;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocTemplate;
import com.cwgsyw.platform.module.user.UserMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChangeDocService {

    private final ChangeDocMapper changeDocMapper;
    private final ChangeDocSnapshotMapper changeDocSnapshotMapper;
    private final ChangeDocFieldMapper changeDocFieldMapper;
    private final ChangeDocTemplateMapper changeDocTemplateMapper;
    private final ChangeDocCiLinkMapper changeDocCiLinkMapper;
    private final com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper ciInstanceMapper;
    private final com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper ciModelMapper;
    private final AuditLogMapper auditLogMapper;
    private final AiGatewayService aiGatewayService;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;
    private final ExportService exportService;
    private final com.cwgsyw.platform.module.sharedfile.SharedFileService sharedFileService;

    // daily counter: key = "tenantId:yyyyMMdd"
    private final ConcurrentHashMap<String, AtomicInteger> dailyCounters = new ConcurrentHashMap<>();

    // ─── Change number generation ─────────────────────────────────────────────

    private String generateChangeNo(String tenantId) {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        String prefix = "CHG-" + dateStr;
        String counterKey = tenantId + ":" + dateStr;

        AtomicInteger counter = dailyCounters.computeIfAbsent(counterKey, k ->
                new AtomicInteger(changeDocMapper.maxSeqForPrefix(tenantId, prefix)));

        int seq = counter.incrementAndGet();
        return String.format("%s-%03d", prefix, seq);
    }

    // ─── Mapping helpers ─────────────────────────────────────────────────────

    private ChangeDocVO toVO(ChangeDoc doc, Map<Long, String> userNames) {
        ChangeDocVO vo = new ChangeDocVO();
        vo.setId(doc.getId());
        vo.setChangeNo(doc.getChangeNo());
        vo.setTitle(doc.getTitle());
        vo.setStatus(doc.getStatus());
        vo.setApplicantId(doc.getApplicantId());
        vo.setApplyTime(doc.getApplyTime());
        vo.setApprovedAt(doc.getApprovedAt());
        vo.setApproverId(doc.getApproverId());
        vo.setApproverComment(doc.getApproverComment());
        vo.setCreatedAt(doc.getCreatedAt());
        vo.setUpdatedAt(doc.getUpdatedAt());
        vo.setFieldsData(doc.getFieldsData());

        if (doc.getApplicantId() != null) {
            vo.setApplicantName(userNames.get(doc.getApplicantId()));
        }
        if (doc.getApproverId() != null) {
            vo.setApproverName(userNames.get(doc.getApproverId()));
        }

        // Resolve dual template names
        vo.setApplicationTemplateId(doc.getApplicationTemplateId());
        vo.setPlanTemplateId(doc.getPlanTemplateId());
        if (doc.getApplicationTemplateId() != null) {
            ChangeDocTemplate appTpl = changeDocTemplateMapper.selectById(doc.getApplicationTemplateId());
            vo.setApplicationTemplateName(appTpl != null ? appTpl.getName() : null);
        }
        if (doc.getPlanTemplateId() != null) {
            ChangeDocTemplate planTpl = changeDocTemplateMapper.selectById(doc.getPlanTemplateId());
            vo.setPlanTemplateName(planTpl != null ? planTpl.getName() : null);
        }

        return vo;
    }

    private ChangeDocVO toVO(ChangeDoc doc) {
        Map<Long, String> userNames = new HashMap<>();
        Set<Long> ids = new java.util.HashSet<>();
        if (doc.getApplicantId() != null) ids.add(doc.getApplicantId());
        if (doc.getApproverId() != null) ids.add(doc.getApproverId());
        for (Long uid : ids) {
            try {
                var user = userMapper.selectById(uid);
                if (user != null) userNames.put(uid, user.getUsername());
            } catch (Exception e) {
                log.debug("Could not resolve user name for id {}", uid);
            }
        }
        return toVO(doc, userNames);
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }

    // ─── Snapshot & audit ────────────────────────────────────────────────────

    private void saveSnapshot(ChangeDoc doc, Long operatorId, String remark) {
        ChangeDocSnapshot snap = new ChangeDocSnapshot();
        snap.setChangeDocId(doc.getId());
        snap.setSnapshotJson(toJson(doc));
        snap.setOperatorId(operatorId);
        snap.setRemark(remark);
        snap.setCreatedAt(LocalDateTime.now());
        changeDocSnapshotMapper.insert(snap);
    }

    private void writeAuditLog(String tenantId, String action, Long targetId, Long operatorId,
                                String beforeJson, String afterJson, String remark) {
        AuditLog log = AuditLog.builder()
                .tenantId(tenantId)
                .module("change_doc")
                .action(action)
                .targetId(targetId)
                .targetType("ChangeDoc")
                .operatorId(operatorId)
                .beforeJson(beforeJson)
                .afterJson(afterJson)
                .remark(remark)
                .createdAt(LocalDateTime.now())
                .build();
        auditLogMapper.insert(log);
    }

    // ─── CRUD operations ─────────────────────────────────────────────────────

    @Transactional
    public ChangeDocVO create(String tenantId, Long operatorId, CreateChangeDocRequest req) {
        ChangeDoc doc = new ChangeDoc();
        doc.setTenantId(tenantId);
        doc.setChangeNo(StringUtils.hasText(req.getChangeNo()) ? req.getChangeNo() : generateChangeNo(tenantId));
        doc.setApplicationTemplateId(req.getApplicationTemplateId());
        doc.setPlanTemplateId(req.getPlanTemplateId());
        doc.setFieldsData(req.getFieldsData());

        // Title 一阶字段优先，兜底从 fieldsData["title"] 或 changeNo 派生
        Map<String, String> fd = req.getFieldsData();
        String title;
        if (StringUtils.hasText(req.getTitle())) {
            title = req.getTitle();
        } else if (fd != null && fd.containsKey("title") && !fd.get("title").isBlank()) {
            title = fd.get("title");
        } else {
            title = doc.getChangeNo();
        }
        doc.setTitle(title);

        doc.setStatus("draft");
        doc.setApplicantId(operatorId);
        doc.setApplyTime(LocalDateTime.now());
        doc.setCreatedBy(operatorId);
        doc.setCreatedAt(LocalDateTime.now());
        doc.setUpdatedAt(LocalDateTime.now());

        changeDocMapper.insert(doc);
        saveSnapshot(doc, operatorId, "create");
        writeAuditLog(tenantId, "create", doc.getId(), operatorId, null, toJson(doc), "创建变更文档");

        return toVO(doc);
    }

    @Transactional
    public ChangeDocVO update(String tenantId, Long id, Long operatorId, UpdateChangeDocRequest req) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }
        boolean isDraft = "draft".equals(doc.getStatus());
        boolean isPlanPending = "plan_pending".equals(doc.getStatus());
        boolean isApproved = "approved".equals(doc.getStatus());
        boolean isRejected = "rejected".equals(doc.getStatus());
        if (!isDraft && !isPlanPending && !isApproved && !isRejected) {
            throw new IllegalStateException("当前状态不允许编辑");
        }

        String beforeJson = toJson(doc);

        // Title 优先取 req.title
        if (StringUtils.hasText(req.getTitle())) {
            doc.setTitle(req.getTitle());
        }

        if (req.getFieldsData() != null && !req.getFieldsData().isEmpty()) {
            Map<String, String> merged = new HashMap<>();
            if (doc.getFieldsData() != null) merged.putAll(doc.getFieldsData());
            merged.putAll(req.getFieldsData());
            doc.setFieldsData(merged);

            // 兼容老数据：fieldsData["title"] 也同步到一阶字段
            if (!StringUtils.hasText(req.getTitle()) && merged.containsKey("title")
                    && StringUtils.hasText(merged.get("title"))) {
                doc.setTitle(merged.get("title"));
            }
        }

        // 模板 ID 修改规则：
        // - draft / approved / rejected → 两个模板都可改
        // - plan_pending → 仅可补填 plan_template_id
        if ((isDraft || isApproved || isRejected) && req.getApplicationTemplateId() != null) {
            doc.setApplicationTemplateId(req.getApplicationTemplateId());
        }
        if ((isDraft || isPlanPending || isApproved || isRejected) && req.getPlanTemplateId() != null) {
            doc.setPlanTemplateId(req.getPlanTemplateId());
        }

        // approved / rejected 状态编辑后回到 draft 重审，清空审批结果
        if (isApproved || isRejected) {
            doc.setStatus("draft");
            doc.setApprovedAt(null);
            doc.setApproverId(null);
            doc.setApproverComment(null);
        }

        doc.setUpdatedAt(LocalDateTime.now());

        changeDocMapper.updateById(doc);
        saveSnapshot(doc, operatorId, "update");
        writeAuditLog(tenantId, "update", id, operatorId, beforeJson, toJson(doc), "更新变更文档");

        return toVO(doc);
    }

    @Transactional
    public ChangeDocVO submit(String tenantId, Long id, Long operatorId) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }
        if (!"draft".equals(doc.getStatus())) {
            throw new IllegalStateException("只有草稿状态的文档可以提交");
        }
        if (doc.getApplicationTemplateId() == null && doc.getPlanTemplateId() == null) {
            throw new IllegalStateException("至少要选择一个模板才能提交");
        }

        String beforeJson = toJson(doc);
        // 只填了 application 没填 plan → plan_pending；其他情况 → pending
        boolean planPending = doc.getApplicationTemplateId() != null && doc.getPlanTemplateId() == null;
        doc.setStatus(planPending ? "plan_pending" : "pending");
        doc.setUpdatedAt(LocalDateTime.now());

        changeDocMapper.updateById(doc);
        saveSnapshot(doc, operatorId, "submit");
        writeAuditLog(tenantId, "submit", id, operatorId, beforeJson, toJson(doc),
                planPending ? "提交申请单（待补填方案）" : "提交变更文档审批");

        return toVO(doc);
    }

    @Transactional
    public ChangeDocVO submitPlan(String tenantId, Long id, Long operatorId) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }
        if (!"plan_pending".equals(doc.getStatus())) {
            throw new IllegalStateException("只有待补填方案状态的文档可以提交方案");
        }
        if (doc.getPlanTemplateId() == null) {
            throw new IllegalStateException("请先选择方案模板");
        }

        String beforeJson = toJson(doc);
        doc.setStatus("pending");
        doc.setUpdatedAt(LocalDateTime.now());

        changeDocMapper.updateById(doc);
        saveSnapshot(doc, operatorId, "submit_plan");
        writeAuditLog(tenantId, "submit_plan", id, operatorId, beforeJson, toJson(doc), "补填方案并提交审批");

        return toVO(doc);
    }

    @Transactional
    public ChangeDocVO approve(String tenantId, Long id, Long approverId, String comment, boolean approved) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }
        if (!"pending".equals(doc.getStatus())) {
            throw new IllegalStateException("只有待审批状态的文档可以审批");
        }

        String beforeJson = toJson(doc);
        doc.setStatus(approved ? "approved" : "rejected");
        doc.setApproverId(approverId);
        doc.setApproverComment(comment);
        doc.setApprovedAt(LocalDateTime.now());
        doc.setUpdatedAt(LocalDateTime.now());

        changeDocMapper.updateById(doc);
        String action = approved ? "approve" : "reject";
        saveSnapshot(doc, approverId, action);
        writeAuditLog(tenantId, action, id, approverId, beforeJson, toJson(doc),
                approved ? "审批通过" : "审批拒绝：" + comment);

        // Approved → 自动归档到共享文件库（按选了的模板各归档一份）
        if (approved) {
            try {
                ChangeDocVO vo = toVO(doc);
                String changeNo = doc.getChangeNo();
                if (doc.getApplicationTemplateId() != null) {
                    byte[] word = exportService.exportDocxFor(vo, tenantId, doc.getApplicationTemplateId());
                    byte[] pdf  = exportService.exportPdfDirect(vo, tenantId);
                    sharedFileService.archiveDocPart(tenantId, approverId, id, word, pdf,
                            changeNo + "_申请单", "application");
                }
                if (doc.getPlanTemplateId() != null) {
                    byte[] word = exportService.exportDocxFor(vo, tenantId, doc.getPlanTemplateId());
                    byte[] pdf  = exportService.exportPdfDirect(vo, tenantId);
                    sharedFileService.archiveDocPart(tenantId, approverId, id, word, pdf,
                            changeNo + "_方案", "plan");
                }
                writeAuditLog(tenantId, "archive", id, approverId, null, null, "审批通过自动归档");
            } catch (Exception e) {
                // 归档失败不阻断审批通过，只记日志
                log.error("审批归档失败 changeDocId={}: {}", id, e.getMessage(), e);
            }
        }

        return toVO(doc);
    }

    public String generateAiContent(String tenantId, Long id, Long operatorId, AiGenerateRequest req) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }

        Map<String, String> fd = doc.getFieldsData() != null ? doc.getFieldsData() : Map.of();

        String changeDesc   = req.getChangeDesc()   != null ? req.getChangeDesc()   : fd.getOrDefault("change_desc", "");
        String impactScope  = req.getImpactScope()  != null ? req.getImpactScope()  : fd.getOrDefault("impact_scope", "");
        String changeWindow = req.getChangeWindow() != null ? req.getChangeWindow() : fd.getOrDefault("change_window", "");

        String prompt = String.format("""
                请根据以下变更信息，生成专业的变更方案内容，包含：背景与目的、详细操作步骤、风险评估与应对措施、回滚计划、验证方法。

                变更描述：%s
                影响范围：%s
                变更时间窗口：%s

                请用JSON格式返回，字段：background, steps, risk_assessment, rollback_plan, verify_method。每个字段的值为HTML格式的富文本内容。
                """,
                changeDesc, impactScope, changeWindow);

        String result = aiGatewayService.generate(tenantId, prompt, "ChangeDoc", id, operatorId);
        writeAuditLog(tenantId, "ai_generate", id, operatorId, null, null, "AI生成变更方案内容");

        return result;
    }

    public List<ChangeDocVO> list(String tenantId, String status) {
        LambdaQueryWrapper<ChangeDoc> wrapper = new LambdaQueryWrapper<ChangeDoc>()
                .eq(ChangeDoc::getTenantId, tenantId)
                .orderByDesc(ChangeDoc::getCreatedAt);

        if (StringUtils.hasText(status)) {
            wrapper.eq(ChangeDoc::getStatus, status);
        }

        List<ChangeDoc> docs = changeDocMapper.selectList(wrapper);

        // Batch-fetch user names to avoid N+1 queries
        Set<Long> userIds = docs.stream()
                .flatMap(d -> {
                    Set<Long> ids = new java.util.HashSet<>();
                    if (d.getApplicantId() != null) ids.add(d.getApplicantId());
                    if (d.getApproverId() != null) ids.add(d.getApproverId());
                    return ids.stream();
                })
                .collect(Collectors.toSet());

        Map<Long, String> userNames = new HashMap<>();
        if (!userIds.isEmpty()) {
            userIds.forEach(uid -> {
                try {
                    var user = userMapper.selectById(uid);
                    if (user != null) userNames.put(uid, user.getUsername());
                } catch (Exception e) {
                    log.debug("Could not resolve user name for id {}", uid);
                }
            });
        }

        return docs.stream()
                .map(d -> toVO(d, userNames))
                .collect(Collectors.toList());
    }

    public List<ChangeDocSnapshot> listSnapshots(String tenantId, Long id) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }
        return changeDocSnapshotMapper.selectList(
                new LambdaQueryWrapper<ChangeDocSnapshot>()
                        .eq(ChangeDocSnapshot::getChangeDocId, id)
                        .orderByAsc(ChangeDocSnapshot::getCreatedAt));
    }

    public ChangeDocVO get(String tenantId, Long id) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }
        ChangeDocVO vo = toVO(doc);
        // Enrich with dual field configs from templates
        if (doc.getApplicationTemplateId() != null) {
            List<ChangeDocField> appFields = changeDocFieldMapper.findByTemplate(doc.getApplicationTemplateId());
            List<FieldConfigVO> appFieldVOs = appFields.stream().map(f -> {
                FieldConfigVO fvo = new FieldConfigVO();
                fvo.setId(f.getId());
                fvo.setFieldKey(f.getFieldKey());
                fvo.setLabel(f.getLabel());
                fvo.setFieldType(f.getFieldType());
                fvo.setRequired(f.getRequired());
                fvo.setInForm(f.getInForm());
                fvo.setPlaceholder(f.getPlaceholder());
                fvo.setSortOrder(f.getSortOrder());
                return fvo;
            }).collect(java.util.stream.Collectors.toList());
            vo.setApplicationFieldConfig(appFieldVOs);
        }
        if (doc.getPlanTemplateId() != null) {
            List<ChangeDocField> planFields = changeDocFieldMapper.findByTemplate(doc.getPlanTemplateId());
            List<FieldConfigVO> planFieldVOs = planFields.stream().map(f -> {
                FieldConfigVO fvo = new FieldConfigVO();
                fvo.setId(f.getId());
                fvo.setFieldKey(f.getFieldKey());
                fvo.setLabel(f.getLabel());
                fvo.setFieldType(f.getFieldType());
                fvo.setRequired(f.getRequired());
                fvo.setInForm(f.getInForm());
                fvo.setPlaceholder(f.getPlaceholder());
                fvo.setSortOrder(f.getSortOrder());
                return fvo;
            }).collect(java.util.stream.Collectors.toList());
            vo.setPlanFieldConfig(planFieldVOs);
        }
        return vo;
    }

    @Transactional
    public void delete(String tenantId, Long id, Long operatorId) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }
        if (!"draft".equals(doc.getStatus())) {
            throw new IllegalStateException("只有草稿状态的文档可以删除");
        }

        String beforeJson = toJson(doc);
        doc.setDeletedAt(LocalDateTime.now());
        doc.setDeletedBy(operatorId);
        doc.setUpdatedAt(LocalDateTime.now());

        changeDocMapper.updateById(doc);
        changeDocMapper.deleteById(id);
        writeAuditLog(tenantId, "delete", id, operatorId, beforeJson, null, "软删除变更文档");
    }

    // ─── CI Links ─────────────────────────────────────────────────────────

    public List<com.cwgsyw.platform.module.changedoc.dto.LinkedCiInstanceVO> listCiLinks(String tenantId, Long changeDocId) {
        // 文档存在性校验（顺便做 tenant 隔离）
        ChangeDoc doc = changeDocMapper.selectById(changeDocId);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }

        List<com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink> links = changeDocCiLinkMapper.selectList(
                new LambdaQueryWrapper<com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink>()
                        .eq(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getTenantId, tenantId)
                        .eq(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getChangeDocId, changeDocId)
                        .orderByAsc(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getCreatedAt));

        if (links.isEmpty()) return List.of();

        // 批量取 instance + model
        Set<Long> instanceIds = links.stream()
                .map(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getInstanceId)
                .collect(Collectors.toSet());

        Map<Long, com.cwgsyw.platform.module.cmdb.entity.CiInstance> instMap =
                ciInstanceMapper.selectBatchIds(instanceIds).stream()
                        .collect(Collectors.toMap(com.cwgsyw.platform.module.cmdb.entity.CiInstance::getId, x -> x));

        Set<String> modelIds = instMap.values().stream()
                .map(com.cwgsyw.platform.module.cmdb.entity.CiInstance::getModelId)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toSet());

        Map<String, String> modelNames = new HashMap<>();
        if (!modelIds.isEmpty()) {
            ciModelMapper.selectList(new LambdaQueryWrapper<com.cwgsyw.platform.module.cmdb.entity.CiModel>()
                            .in(com.cwgsyw.platform.module.cmdb.entity.CiModel::getModelId, modelIds))
                    .forEach(m -> modelNames.put(m.getModelId(), m.getName()));
        }

        return links.stream().map(link -> {
            com.cwgsyw.platform.module.changedoc.dto.LinkedCiInstanceVO vo =
                    new com.cwgsyw.platform.module.changedoc.dto.LinkedCiInstanceVO();
            com.cwgsyw.platform.module.cmdb.entity.CiInstance ci = instMap.get(link.getInstanceId());
            if (ci == null) return null;
            vo.setId(ci.getId());
            vo.setName(ci.getName());
            vo.setModelId(ci.getModelId());
            vo.setModelName(modelNames.get(ci.getModelId()));
            vo.setOwner(ci.getOwner());
            vo.setStatus(ci.getStatus());
            vo.setImpactLevel(link.getImpactLevel());
            vo.setLinkCreatedAt(link.getCreatedAt());
            return vo;
        }).filter(java.util.Objects::nonNull).collect(Collectors.toList());
    }

    @Transactional
    public void addCiLinks(String tenantId, Long changeDocId, Long operatorId,
                           List<com.cwgsyw.platform.module.changedoc.dto.AddCiLinkRequest.Item> items) {
        ChangeDoc doc = changeDocMapper.selectById(changeDocId);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }
        if (items == null || items.isEmpty()) return;

        LocalDateTime now = LocalDateTime.now();
        for (var item : items) {
            if (item.getInstanceId() == null) continue;

            // 已有同 (changeDocId, instanceId) 且未删除 → 跳过（unique index 保护）
            Long existing = changeDocCiLinkMapper.selectCount(
                    new LambdaQueryWrapper<com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink>()
                            .eq(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getChangeDocId, changeDocId)
                            .eq(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getInstanceId, item.getInstanceId()));
            if (existing != null && existing > 0) continue;

            com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink link =
                    new com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink();
            link.setTenantId(tenantId);
            link.setChangeDocId(changeDocId);
            link.setInstanceId(item.getInstanceId());
            link.setImpactLevel(item.getImpactLevel());
            link.setCreatedBy(operatorId);
            link.setUpdatedBy(operatorId == null ? 0L : operatorId);
            link.setCreatedAt(now);
            link.setUpdatedAt(now);
            changeDocCiLinkMapper.insert(link);
        }
        writeAuditLog(tenantId, "link_ci", changeDocId, operatorId, null, toJson(items), "关联 CI 实例");
    }

    @Transactional
    public void removeCiLink(String tenantId, Long changeDocId, Long instanceId, Long operatorId) {
        ChangeDoc doc = changeDocMapper.selectById(changeDocId);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }
        changeDocCiLinkMapper.delete(
                new LambdaQueryWrapper<com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink>()
                        .eq(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getChangeDocId, changeDocId)
                        .eq(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getInstanceId, instanceId));
        writeAuditLog(tenantId, "unlink_ci", changeDocId, operatorId, null,
                "{\"instanceId\":" + instanceId + "}", "取消 CI 关联");
    }
}
