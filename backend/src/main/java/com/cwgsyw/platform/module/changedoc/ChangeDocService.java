package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.ai.AiGatewayService;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocSnapshot;
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
    private final AuditLogMapper auditLogMapper;
    private final AiGatewayService aiGatewayService;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

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
        vo.setStatus(doc.getStatus());
        vo.setTemplateId(doc.getTemplateId());
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

        // Resolve template name
        if (doc.getTemplateId() != null) {
            try {
                ChangeDocTemplate tpl = changeDocTemplateMapper.selectById(doc.getTemplateId());
                if (tpl != null) vo.setTemplateName(tpl.getName());
            } catch (Exception e) {
                log.debug("Could not resolve template name for id {}", doc.getTemplateId());
            }
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
        doc.setTemplateId(req.getTemplateId());
        doc.setFieldsData(req.getFieldsData());

        // Derive legacy title column from fieldsData; fall back to changeNo to satisfy NOT NULL
        Map<String, String> fd = req.getFieldsData();
        String title = (fd != null && fd.containsKey("title") && !fd.get("title").isBlank())
                ? fd.get("title") : doc.getChangeNo();
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
        if (!"draft".equals(doc.getStatus())) {
            throw new IllegalStateException("只有草稿状态的文档可以编辑");
        }

        String beforeJson = toJson(doc);

        if (req.getFieldsData() != null && !req.getFieldsData().isEmpty()) {
            Map<String, String> merged = new HashMap<>();
            if (doc.getFieldsData() != null) merged.putAll(doc.getFieldsData());
            merged.putAll(req.getFieldsData());
            doc.setFieldsData(merged);

            // Sync legacy title column if changed
            if (merged.containsKey("title")) {
                doc.setTitle(merged.get("title"));
            }
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

        String beforeJson = toJson(doc);
        doc.setStatus("pending");
        doc.setUpdatedAt(LocalDateTime.now());

        changeDocMapper.updateById(doc);
        saveSnapshot(doc, operatorId, "submit");
        writeAuditLog(tenantId, "submit", id, operatorId, beforeJson, toJson(doc), "提交变更文档审批");

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
        // Enrich with field config from template
        if (doc.getTemplateId() != null) {
            List<FieldConfigVO> fieldConfig = changeDocFieldMapper.findByTemplate(doc.getTemplateId())
                    .stream().map(f -> {
                        FieldConfigVO fvo = new FieldConfigVO();
                        fvo.setId(f.getId());
                        fvo.setFieldKey(f.getFieldKey());
                        fvo.setLabel(f.getLabel());
                        fvo.setFieldType(f.getFieldType());
                        fvo.setSortOrder(f.getSortOrder());
                        fvo.setRequired(f.getRequired());
                        fvo.setInForm(f.getInForm());
                        fvo.setPlaceholder(f.getPlaceholder());
                        return fvo;
                    }).collect(Collectors.toList());
            vo.setFieldConfig(fieldConfig);
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
        doc.setIsDeleted(true);
        doc.setDeletedAt(LocalDateTime.now());
        doc.setDeletedBy(operatorId);
        doc.setUpdatedAt(LocalDateTime.now());

        changeDocMapper.updateById(doc);
        writeAuditLog(tenantId, "delete", id, operatorId, beforeJson, null, "软删除变更文档");
    }
}
