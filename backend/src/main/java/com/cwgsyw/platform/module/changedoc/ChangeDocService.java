package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.ai.AiGatewayService;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocSnapshot;
import com.cwgsyw.platform.module.user.UserMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChangeDocService {

    private final ChangeDocMapper changeDocMapper;
    private final ChangeDocSnapshotMapper changeDocSnapshotMapper;
    private final AuditLogMapper auditLogMapper;
    private final AiGatewayService aiGatewayService;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;

    // daily counter: key = "tenantId:yyyy-MMdd"
    private final ConcurrentHashMap<String, AtomicInteger> dailyCounters = new ConcurrentHashMap<>();
    private volatile String lastInitDate = "";

    @PostConstruct
    public void initCounters() {
        // counters are initialized lazily on first use
    }

    // ─── Change number generation ─────────────────────────────────────────────

    private String generateChangeNo(String tenantId) {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MMdd"));
        String prefix = "CHG-" + dateStr;
        String counterKey = tenantId + ":" + dateStr;

        dailyCounters.computeIfAbsent(counterKey, k -> {
            int maxSeq = changeDocMapper.maxSeqForPrefix(tenantId, prefix);
            return new AtomicInteger(maxSeq);
        });

        int seq = dailyCounters.get(counterKey).incrementAndGet();
        return String.format("%s-%03d", prefix, seq);
    }

    // ─── Mapping helpers ─────────────────────────────────────────────────────

    private ChangeDocVO toVO(ChangeDoc doc) {
        ChangeDocVO vo = new ChangeDocVO();
        vo.setId(doc.getId());
        vo.setChangeNo(doc.getChangeNo());
        vo.setTitle(doc.getTitle());
        vo.setStatus(doc.getStatus());
        vo.setApplicantId(doc.getApplicantId());
        vo.setApplyTime(doc.getApplyTime());
        vo.setChangeDesc(doc.getChangeDesc());
        vo.setImpactScope(doc.getImpactScope());
        vo.setChangeWindow(doc.getChangeWindow());
        vo.setResourceSupport(doc.getResourceSupport());
        vo.setBackground(doc.getBackground());
        vo.setSteps(doc.getSteps());
        vo.setRiskAssessment(doc.getRiskAssessment());
        vo.setRollbackPlan(doc.getRollbackPlan());
        vo.setVerifyMethod(doc.getVerifyMethod());
        vo.setContacts(doc.getContacts());
        vo.setApprovedAt(doc.getApprovedAt());
        vo.setApproverId(doc.getApproverId());
        vo.setApproverComment(doc.getApproverComment());
        vo.setCreatedAt(doc.getCreatedAt());
        vo.setUpdatedAt(doc.getUpdatedAt());

        // resolve names via UserMapper
        if (doc.getApplicantId() != null) {
            try {
                var user = userMapper.selectById(doc.getApplicantId());
                if (user != null) vo.setApplicantName(user.getUsername());
            } catch (Exception e) {
                log.debug("Could not resolve applicant name for id {}", doc.getApplicantId());
            }
        }
        if (doc.getApproverId() != null) {
            try {
                var user = userMapper.selectById(doc.getApproverId());
                if (user != null) vo.setApproverName(user.getUsername());
            } catch (Exception e) {
                log.debug("Could not resolve approver name for id {}", doc.getApproverId());
            }
        }

        return vo;
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
        doc.setTitle(req.getTitle());
        doc.setStatus("draft");
        doc.setApplicantId(operatorId);
        doc.setApplyTime(LocalDateTime.now());
        doc.setChangeDesc(req.getChangeDesc());
        doc.setImpactScope(req.getImpactScope());
        doc.setChangeWindow(req.getChangeWindow());
        doc.setResourceSupport(req.getResourceSupport());
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

        if (StringUtils.hasText(req.getTitle())) doc.setTitle(req.getTitle());
        if (req.getChangeDesc() != null) doc.setChangeDesc(req.getChangeDesc());
        if (req.getImpactScope() != null) doc.setImpactScope(req.getImpactScope());
        if (req.getChangeWindow() != null) doc.setChangeWindow(req.getChangeWindow());
        if (req.getResourceSupport() != null) doc.setResourceSupport(req.getResourceSupport());
        if (req.getBackground() != null) doc.setBackground(req.getBackground());
        if (req.getSteps() != null) doc.setSteps(req.getSteps());
        if (req.getRiskAssessment() != null) doc.setRiskAssessment(req.getRiskAssessment());
        if (req.getRollbackPlan() != null) doc.setRollbackPlan(req.getRollbackPlan());
        if (req.getVerifyMethod() != null) doc.setVerifyMethod(req.getVerifyMethod());
        if (req.getContacts() != null) doc.setContacts(req.getContacts());
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

    @Transactional
    public String generateAiContent(String tenantId, Long id, Long operatorId, AiGenerateRequest req) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }

        String prompt = String.format("""
                请根据以下变更信息，生成专业的变更方案内容，包含：背景与目的、详细操作步骤、风险评估与应对措施、回滚计划、验证方法。

                变更描述：%s
                影响范围：%s
                变更时间窗口：%s

                请用JSON格式返回，字段：background, steps, risk_assessment, rollback_plan, verify_method。每个字段的值为HTML格式的富文本内容。
                """,
                req.getChangeDesc() != null ? req.getChangeDesc() : doc.getChangeDesc(),
                req.getImpactScope() != null ? req.getImpactScope() : doc.getImpactScope(),
                req.getChangeWindow() != null ? req.getChangeWindow() : doc.getChangeWindow());

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

        return changeDocMapper.selectList(wrapper).stream()
                .map(this::toVO)
                .collect(Collectors.toList());
    }

    public ChangeDocVO get(String tenantId, Long id) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !tenantId.equals(doc.getTenantId())) {
            throw new IllegalArgumentException("变更文档不存在");
        }
        return toVO(doc);
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
