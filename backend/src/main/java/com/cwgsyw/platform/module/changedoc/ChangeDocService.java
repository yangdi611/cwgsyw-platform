package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.ai.AiGatewayService;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocSnapshot;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocTemplate;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
    private final GroupMapper groupMapper;
    private final ObjectMapper objectMapper;
    private final ExportService exportService;
    private final com.cwgsyw.platform.module.sharedfile.SharedFileService sharedFileService;
    private final TableFieldSupport tableFieldSupport;
    private final ChangeDocLinkService changeDocLinkService;
    private final NotificationService notificationService;

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

    private ChangeDoc requireAccessibleDoc(SecurityUser user, Long id) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !user.getTenantId().equals(doc.getTenantId()) || !canAccess(user, doc)) {
            throw new BusinessException(404, "RESOURCE_NOT_FOUND", "变更文档不存在");
        }
        return doc;
    }

    private boolean canAccess(SecurityUser user, ChangeDoc doc) {
        if ("tenant".equals(user.getGroupScope()) || "platform".equals(user.getGroupScope())) {
            return true;
        }
        if (doc.getApplicantId() == null) {
            return false;
        }
        if (doc.getApplicantId().equals(user.getUserId())) {
            return true;
        }
        if (!"group".equals(user.getGroupScope()) || user.getGroupId() == null) {
            return false;
        }
        User applicant = userMapper.selectById(doc.getApplicantId());
        if (applicant == null || !user.getTenantId().equals(applicant.getTenantId())
                || !user.getGroupId().equals(applicant.getGroupId())) {
            return false;
        }
        var group = groupMapper.findByTenantAndIdIncludingDeleted(user.getTenantId(), user.getGroupId());
        return group != null && user.getUserId().equals(group.getLeaderId());
    }

    private LambdaQueryWrapper<ChangeDoc> applyAccessScope(LambdaQueryWrapper<ChangeDoc> query, SecurityUser user) {
        if ("tenant".equals(user.getGroupScope()) || "platform".equals(user.getGroupScope())) {
            return query;
        }
        if (isGroupLeader(user)) {
            List<Long> groupMemberIds = userMapper.selectList(new LambdaQueryWrapper<User>()
                            .eq(User::getTenantId, user.getTenantId())
                            .eq(User::getGroupId, user.getGroupId()))
                    .stream().map(User::getId).collect(Collectors.toList());
            if (groupMemberIds.isEmpty()) {
                return query.apply("1 = 0");
            }
            return query.in(ChangeDoc::getApplicantId, groupMemberIds);
        }
        return query.eq(ChangeDoc::getApplicantId, user.getUserId());
    }

    private boolean isGroupLeader(SecurityUser user) {
        if (!"group".equals(user.getGroupScope()) || user.getGroupId() == null) {
            return false;
        }
        var group = groupMapper.findByTenantAndIdIncludingDeleted(user.getTenantId(), user.getGroupId());
        return group != null && user.getUserId().equals(group.getLeaderId());
    }

    /** 将 fieldsData 中的普通字段值格式化为字符串；表格数组/对象值返回空字符串。 */
    private String stringOf(Object v) {
        if (v == null) return "";
        if (v instanceof String s) return s;
        if (v instanceof List || v instanceof Map) return "";
        return v.toString();
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

    /** 汇总 application + plan 两个模板的字段配置，供 fieldsData 校验使用。 */
    private List<ChangeDocField> loadFieldsForTemplates(Long applicationTemplateId, Long planTemplateId) {
        List<ChangeDocField> fields = new ArrayList<>();
        if (applicationTemplateId != null) fields.addAll(changeDocFieldMapper.findByTemplate(applicationTemplateId));
        if (planTemplateId != null) fields.addAll(changeDocFieldMapper.findByTemplate(planTemplateId));
        return fields;
    }

    @Transactional
    public ChangeDocVO create(String tenantId, Long operatorId, CreateChangeDocRequest req) {
        ChangeDoc doc = new ChangeDoc();
        doc.setTenantId(tenantId);
        doc.setChangeNo(StringUtils.hasText(req.getChangeNo()) ? req.getChangeNo() : generateChangeNo(tenantId));
        doc.setApplicationTemplateId(req.getApplicationTemplateId());
        doc.setPlanTemplateId(req.getPlanTemplateId());

        // 创建时只做结构性/类型校验，必填校验推迟到 submit
        List<ChangeDocField> fields = loadFieldsForTemplates(req.getApplicationTemplateId(), req.getPlanTemplateId());
        Map<String, Object> fieldsData = tableFieldSupport.validateAndNormalize(fields, req.getFieldsData(), false);
        doc.setFieldsData(fieldsData);

        // Title 一阶字段优先，兜底从 fieldsData["title"] 或 changeNo 派生
        String title;
        if (StringUtils.hasText(req.getTitle())) {
            title = req.getTitle();
        } else if (fieldsData.get("title") instanceof String s && StringUtils.hasText(s)) {
            title = s;
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
        if (req.getCiSnapshots() != null && !req.getCiSnapshots().isEmpty()) {
            LinkCiRequest linkRequest = new LinkCiRequest();
            linkRequest.setLinks(req.getCiSnapshots());
            changeDocLinkService.linkCiInstances(tenantId, doc.getId(), operatorId, linkRequest);
        }
        saveSnapshot(doc, operatorId, "create");
        writeAuditLog(tenantId, "create", doc.getId(), operatorId, null, toJson(doc), "创建变更文档");

        return toVO(doc);
    }

    @Transactional
    public ChangeDocVO update(SecurityUser user, Long id, UpdateChangeDocRequest req) {
        String tenantId = user.getTenantId();
        Long operatorId = user.getUserId();
        ChangeDoc doc = requireAccessibleDoc(user, id);
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

        // 模板 ID 修改规则：
        // - draft / approved / rejected → 两个模板都可改
        // - plan_pending → 仅可补填 plan_template_id
        if ((isDraft || isApproved || isRejected) && req.getApplicationTemplateId() != null) {
            doc.setApplicationTemplateId(req.getApplicationTemplateId());
        }
        if ((isDraft || isPlanPending || isApproved || isRejected) && req.getPlanTemplateId() != null) {
            doc.setPlanTemplateId(req.getPlanTemplateId());
        }

        if (req.getFieldsData() != null && !req.getFieldsData().isEmpty()) {
            Map<String, Object> merged = new LinkedHashMap<>();
            if (doc.getFieldsData() != null) merged.putAll(doc.getFieldsData());
            merged.putAll(req.getFieldsData());

            // 更新时只做结构性/类型校验，必填校验推迟到 submit / submitPlan
            List<ChangeDocField> fields = loadFieldsForTemplates(doc.getApplicationTemplateId(), doc.getPlanTemplateId());
            merged = tableFieldSupport.validateAndNormalize(fields, merged, false);
            doc.setFieldsData(merged);

            // 兼容老数据：fieldsData["title"] 也同步到一阶字段
            if (!StringUtils.hasText(req.getTitle()) && merged.get("title") instanceof String s
                    && StringUtils.hasText(s)) {
                doc.setTitle(s);
            }
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
    public ChangeDocVO submit(SecurityUser user, Long id) {
        String tenantId = user.getTenantId();
        Long operatorId = user.getUserId();
        requireAccessibleDoc(user, id);
        ChangeDoc doc = changeDocMapper.selectForUpdate(tenantId, id);
        if (doc == null) throw new IllegalArgumentException("变更文档不存在");
        if (!"draft".equals(doc.getStatus())) {
            throw new IllegalStateException("只有草稿状态的文档可以提交");
        }
        if (doc.getApplicationTemplateId() == null && doc.getPlanTemplateId() == null) {
            throw new IllegalStateException("至少要选择一个模板才能提交");
        }

        String beforeJson = toJson(doc);

        // 只填了 application 没填 plan → plan_pending（此时 plan 字段尚未填写，不校验其必填）；其他情况 → pending（两个模板都需校验）
        boolean planPending = doc.getApplicationTemplateId() != null && doc.getPlanTemplateId() == null;
        List<ChangeDocField> fields = loadFieldsForTemplates(doc.getApplicationTemplateId(),
                planPending ? null : doc.getPlanTemplateId());
        doc.setFieldsData(tableFieldSupport.validateAndNormalize(fields, doc.getFieldsData(), true));

        doc.setStatus(planPending ? "plan_pending" : "pending");
        doc.setUpdatedAt(LocalDateTime.now());

        changeDocMapper.updateById(doc);
        saveSnapshot(doc, operatorId, "submit");
        writeAuditLog(tenantId, "submit", id, operatorId, beforeJson, toJson(doc),
                planPending ? "提交申请单（待补填方案）" : "提交变更文档审批");

        return toVO(doc);
    }

    @Transactional
    public ChangeDocVO submitPlan(SecurityUser user, Long id) {
        String tenantId = user.getTenantId();
        Long operatorId = user.getUserId();
        ChangeDoc doc = requireAccessibleDoc(user, id);
        if (!"plan_pending".equals(doc.getStatus())) {
            throw new IllegalStateException("只有待补填方案状态的文档可以提交方案");
        }
        if (doc.getPlanTemplateId() == null) {
            throw new IllegalStateException("请先选择方案模板");
        }

        String beforeJson = toJson(doc);

        List<ChangeDocField> fields = loadFieldsForTemplates(doc.getApplicationTemplateId(), doc.getPlanTemplateId());
        doc.setFieldsData(tableFieldSupport.validateAndNormalize(fields, doc.getFieldsData(), true));

        doc.setStatus("pending");
        doc.setUpdatedAt(LocalDateTime.now());

        changeDocMapper.updateById(doc);
        saveSnapshot(doc, operatorId, "submit_plan");
        writeAuditLog(tenantId, "submit_plan", id, operatorId, beforeJson, toJson(doc), "补填方案并提交审批");

        return toVO(doc);
    }

    @Transactional
    public ChangeDocVO approve(SecurityUser user, Long id, String comment, boolean approved) {
        String tenantId = user.getTenantId();
        Long approverId = user.getUserId();
        requireAccessibleDoc(user, id);
        ChangeDoc doc = changeDocMapper.selectForUpdate(tenantId, id);
        if (doc == null) throw new IllegalArgumentException("变更文档不存在");
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
            archiveApprovedDoc(doc, tenantId, approverId, id);
        }
        notifyApplicantOfApproval(doc, approved, comment);

        return toVO(doc);
    }

    /** 审批通过后自动归档到共享文件库。归档失败不阻断审批，只记日志。 */
    private void archiveApprovedDoc(ChangeDoc doc, String tenantId, Long approverId, Long id) {
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

    /**
     * 提交变更文档进入 Flowable 审批（可选流程）。
     * 由 ChangeDocWorkflowAdapter.canSubmit 前置校验后调用；返回业务状态是否成功流转。
     */
    public ChangeDoc getForWorkflow(String tenantId, Long id) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null || !tenantId.equals(doc.getTenantId())) return null;
        return doc;
    }

    /**
     * 流程结束后回写变更文档状态（供 ChangeDocWorkflowAdapter 调用）。
     * 按状态幂等：非 pending 状态不再重复回写。
     */
    @Transactional
    public void handleWorkflowApproval(Long id, boolean approved, Long approverId, String comment) {
        ChangeDoc doc = changeDocMapper.selectById(id);
        if (doc == null) return;
        if (!"pending".equals(doc.getStatus())) {
            // 幂等：已终态或未在审批中，跳过
            return;
        }
        String tenantId = doc.getTenantId();
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
                approved ? "流程审批通过" : "流程审批拒绝：" + comment);
        if (approved) {
            archiveApprovedDoc(doc, tenantId, approverId, id);
        }
        notifyApplicantOfApproval(doc, approved, comment);
    }

    private void notifyApplicantOfApproval(ChangeDoc doc, boolean approved, String comment) {
        if (doc.getApplicantId() == null) {
            return;
        }
        String title = approved ? "变更文档审批通过" : "变更文档审批被拒绝";
        String content = approved
                ? "《" + doc.getTitle() + "》已审批通过。"
                : "《" + doc.getTitle() + "》审批被拒绝：" + (comment != null ? comment : "");
        notificationService.notify(doc.getTenantId(), doc.getApplicantId(), title, content,
                "change_doc_approval", "change_doc", doc.getId());
    }

    public String generateAiContent(SecurityUser user, Long id, AiGenerateRequest req) {
        String tenantId = user.getTenantId();
        Long operatorId = user.getUserId();
        ChangeDoc doc = requireAccessibleDoc(user, id);

        Map<String, Object> fd = doc.getFieldsData() != null ? doc.getFieldsData() : Map.of();

        String changeDesc   = req.getChangeDesc()   != null ? req.getChangeDesc()   : stringOf(fd.get("change_desc"));
        String impactScope  = req.getImpactScope()  != null ? req.getImpactScope()  : stringOf(fd.get("impact_scope"));
        String changeWindow = req.getChangeWindow() != null ? req.getChangeWindow() : stringOf(fd.get("change_window"));

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

    /** 全局搜索：按变更单号或标题模糊匹配，限制返回条数。供统一搜索（/api/search）复用。 */
    public List<ChangeDocVO> searchByTitle(SecurityUser user, String keyword, int limit) {
        if (!StringUtils.hasText(keyword)) return List.of();
        String tenantId = user.getTenantId();
        LambdaQueryWrapper<ChangeDoc> query = new LambdaQueryWrapper<ChangeDoc>()
                .eq(ChangeDoc::getTenantId, tenantId)
                .and(w -> w.like(ChangeDoc::getTitle, keyword).or().like(ChangeDoc::getChangeNo, keyword))
                .orderByDesc(ChangeDoc::getCreatedAt)
                .last("LIMIT " + limit);
        List<ChangeDoc> docs = changeDocMapper.selectList(applyAccessScope(query, user));
        return docs.stream().map(this::toVO).collect(Collectors.toList());
    }

    public PageResult<ChangeDocVO> list(SecurityUser user, String status, String keyword, int page, int size) {
        String tenantId = user.getTenantId();
        int normalizedPage = Math.max(page, 1);
        int normalizedSize = Math.min(Math.max(size, 1), 100);
        LambdaQueryWrapper<ChangeDoc> wrapper = new LambdaQueryWrapper<ChangeDoc>()
                .eq(ChangeDoc::getTenantId, tenantId)
                .orderByDesc(ChangeDoc::getCreatedAt);
        applyAccessScope(wrapper, user);

        if (StringUtils.hasText(status)) {
            wrapper.eq(ChangeDoc::getStatus, status);
        }

        if (StringUtils.hasText(keyword)) {
            wrapper.and(query -> query.like(ChangeDoc::getTitle, keyword)
                    .or().like(ChangeDoc::getChangeNo, keyword));
        }

        Page<ChangeDoc> resultPage = changeDocMapper.selectPage(new Page<>(normalizedPage, normalizedSize), wrapper);
        List<ChangeDoc> docs = resultPage.getRecords();

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
                    var applicantUser = userMapper.selectById(uid);
                    if (applicantUser != null) userNames.put(uid, applicantUser.getUsername());
                } catch (Exception e) {
                    log.debug("Could not resolve user name for id {}", uid);
                }
            });
        }

        PageResult<ChangeDocVO> result = new PageResult<>();
        result.setRecords(docs.stream().map(d -> toVO(d, userNames)).collect(Collectors.toList()));
        result.setTotal(resultPage.getTotal());
        result.setPage(resultPage.getCurrent());
        result.setSize(resultPage.getSize());
        return result;
    }

    public List<ChangeDocSnapshot> listSnapshots(SecurityUser user, Long id) {
        ChangeDoc doc = requireAccessibleDoc(user, id);
        return changeDocSnapshotMapper.selectList(
                new LambdaQueryWrapper<ChangeDocSnapshot>()
                        .eq(ChangeDocSnapshot::getChangeDocId, id)
                        .orderByAsc(ChangeDocSnapshot::getCreatedAt));
    }

    public ChangeDocVO get(SecurityUser user, Long id) {
        ChangeDoc doc = requireAccessibleDoc(user, id);
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
                fvo.setConfig(f.getConfig());
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
                fvo.setConfig(f.getConfig());
                return fvo;
            }).collect(java.util.stream.Collectors.toList());
            vo.setPlanFieldConfig(planFieldVOs);
        }
        return vo;
    }

    @Transactional
    public void delete(SecurityUser user, Long id) {
        String tenantId = user.getTenantId();
        Long operatorId = user.getUserId();
        ChangeDoc doc = requireAccessibleDoc(user, id);
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

    @Transactional
    public void purgeRemediationTest(SecurityUser user, Long id, String remediationRunId) {
        String tenantId = user.getTenantId();
        Long operatorId = user.getUserId();
        if (!StringUtils.hasText(remediationRunId)) {
            throw new IllegalArgumentException("缺少 remediationRunId");
        }
        ChangeDoc doc = requireAccessibleDoc(user, id);
        if ("approved".equals(doc.getStatus())) {
            throw new IllegalStateException("已审批归档文档不支持 remediation 清理");
        }
        String beforeJson = toJson(doc);
        if (!containsRemediationRunId(beforeJson, remediationRunId)) {
            throw new IllegalArgumentException("仅允许清理内容带 remediationRunId 的测试变更文档");
        }

        changeDocCiLinkMapper.delete(new LambdaQueryWrapper<com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink>()
                .eq(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getTenantId, tenantId)
                .eq(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getChangeDocId, id));
        changeDocSnapshotMapper.delete(new LambdaQueryWrapper<ChangeDocSnapshot>()
                .eq(ChangeDocSnapshot::getChangeDocId, id));
        doc.setDeletedAt(LocalDateTime.now());
        doc.setDeletedBy(operatorId);
        doc.setUpdatedAt(LocalDateTime.now());
        changeDocMapper.updateById(doc);
        changeDocMapper.deleteById(id);
        writeAuditLog(tenantId, "purge_remediation_test", id, operatorId, beforeJson,
                toJson(Map.of("remediationRunId", remediationRunId)), "清理 remediation 测试变更文档");
    }

    private boolean containsRemediationRunId(String documentJson, String remediationRunId) {
        try {
            return containsTextValue(objectMapper.readTree(documentJson), remediationRunId);
        } catch (Exception exception) {
            log.warn("Could not inspect remediation test marker for change document", exception);
            return false;
        }
    }

    private boolean containsTextValue(JsonNode node, String expectedValue) {
        if (node.isTextual()) {
            return expectedValue.equals(node.asText());
        }
        if (node.isArray()) {
            for (JsonNode child : node) {
                if (containsTextValue(child, expectedValue)) {
                    return true;
                }
            }
        }
        if (node.isObject()) {
            var fields = node.elements();
            while (fields.hasNext()) {
                if (containsTextValue(fields.next(), expectedValue)) {
                    return true;
                }
            }
        }
        return false;
    }

    // ─── CI Links ─────────────────────────────────────────────────────────

    public List<com.cwgsyw.platform.module.changedoc.dto.LinkedCiInstanceVO> listCiLinks(SecurityUser user, Long changeDocId) {
        String tenantId = user.getTenantId();
        requireAccessibleDoc(user, changeDocId);

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
    public void addCiLinks(SecurityUser user, Long changeDocId,
                           List<com.cwgsyw.platform.module.changedoc.dto.AddCiLinkRequest.Item> items) {
        String tenantId = user.getTenantId();
        Long operatorId = user.getUserId();
        requireAccessibleDoc(user, changeDocId);
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
    public void removeCiLink(SecurityUser user, Long changeDocId, Long instanceId) {
        String tenantId = user.getTenantId();
        Long operatorId = user.getUserId();
        requireAccessibleDoc(user, changeDocId);
        changeDocCiLinkMapper.delete(
                new LambdaQueryWrapper<com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink>()
                        .eq(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getChangeDocId, changeDocId)
                        .eq(com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink::getInstanceId, instanceId));
        writeAuditLog(tenantId, "unlink_ci", changeDocId, operatorId, null,
                "{\"instanceId\":" + instanceId + "}", "取消 CI 关联");
    }
}
