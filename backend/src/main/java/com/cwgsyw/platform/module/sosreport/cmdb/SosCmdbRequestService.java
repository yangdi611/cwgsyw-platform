package com.cwgsyw.platform.module.sosreport.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbDraftRequest;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbPreviewVO;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.CmdbRequestVO;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.entity.SosFieldMapping;
import com.cwgsyw.platform.module.sosreport.entity.SosReport;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.sosreport.mapper.SosReportMapper;
import com.cwgsyw.platform.module.sosreport.mapping.SosPresetRules;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.workflow.adapter.SosCmdbWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.event.WorkflowBusinessInstance;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowStartCommand;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 预览 CMDB 草稿，提交入库申请。写 CMDB 只在审批通过后发生，见 {@link SosCmdbApplyService}。
 */
@Service
@RequiredArgsConstructor
public class SosCmdbRequestService {

    private final SosReportMapper reportMapper;
    private final SosCmdbRequestMapper requestMapper;
    private final SosCmdbDraftService draftService;
    private final SosCmdbWorkflowAdapter workflowAdapter;
    private final WorkflowRuntimeFacade workflowRuntimeFacade;
    private final UserMapper userMapper;
    private final AuditLogMapper auditLogMapper;
    private final ApplicationEventPublisher eventPublisher;

    public CmdbPreviewVO preview(SecurityUser user, Long reportId, CmdbDraftRequest input) {
        return draftService.build(requireParsed(user.getTenantId(), reportId), input).preview();
    }

    @Transactional
    public CmdbRequestVO submit(SecurityUser user, Long reportId, CmdbDraftRequest input) {
        String tenantId = user.getTenantId();
        SosReport report = requireParsed(tenantId, reportId);
        SosCmdbDraftService.Draft draft = draftService.build(report, input);
        CmdbPreviewVO preview = draft.preview();
        if (!preview.isCanSubmit()) {
            throw new BusinessException(HttpStatus.CONFLICT, "SOS_CMDB_BLOCKED", String.join("；", preview.getBlockingReasons()));
        }

        SosCmdbRequest request = new SosCmdbRequest();
        request.setTenantId(tenantId);
        request.setReportId(reportId);
        request.setModelCode(SosPresetRules.MODEL_CODE);
        request.setAction(preview.getAction());
        request.setTargetInstanceId(preview.getTargetInstanceId());
        request.setInstanceName(preview.getInstanceName());
        request.setProposedFields(draft.proposedFields());
        request.setFieldDetails(draft.fieldDetails());
        request.setStatus(SosCmdbRequest.STATUS_PENDING);
        request.setSubmitterId(user.getUserId());
        try {
            requestMapper.insert(request);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(HttpStatus.CONFLICT, "SOS_CMDB_PENDING", "这份报告已有审批中的入库申请");
        }

        // WorkflowRuntimeFacade 不检查 canSubmit，需要业务方自己调用。
        if (!workflowAdapter.canSubmit(tenantId, String.valueOf(request.getId()), user)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "SOS_CMDB_FORBIDDEN", "没有提交入库申请的权限");
        }
        WorkflowBusinessInstance instance = workflowRuntimeFacade.startBusinessProcess(WorkflowStartCommand.builder()
            .tenantId(tenantId)
            .businessType(SosCmdbWorkflowAdapter.BUSINESS_TYPE)
            .businessId(String.valueOf(request.getId()))
            .submitterId(user.getUserId())
            .build());

        request.setProcessInstanceId(instance.getProcessInstanceId());
        requestMapper.updateById(request);
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId).module("sos_report").action("cmdb_submit")
            .targetId(request.getId()).targetType("sos_cmdb_request")
            .operatorId(user.getUserId())
            .remark("reportId=" + reportId + " action=" + preview.getAction() + " fields=" + draft.proposedFields().size()
                + " aiFields=" + aiFieldCount(draft.fieldDetails()))
            .createdAt(LocalDateTime.now()).build());
        eventPublisher.publishEvent(new SosApprovalTasksChangedEvent(tenantId, request.getId()));
        return toVO(request, Map.of(user.getUserId(), displayName(user)));
    }

    public List<CmdbRequestVO> list(SecurityUser user, Long reportId) {
        String tenantId = user.getTenantId();
        requireReport(tenantId, reportId);
        List<SosCmdbRequest> requests = requestMapper.selectList(new LambdaQueryWrapper<SosCmdbRequest>()
            .eq(SosCmdbRequest::getTenantId, tenantId)
            .eq(SosCmdbRequest::getReportId, reportId)
            .orderByDesc(SosCmdbRequest::getCreatedAt)
            .orderByDesc(SosCmdbRequest::getId));
        Set<Long> userIds = requests.stream().map(SosCmdbRequest::getSubmitterId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> names = userIds.isEmpty() ? Map.of() : userMapper.selectBatchIds(userIds).stream()
            .collect(Collectors.toMap(User::getId, u -> u.getRealName() != null ? u.getRealName() : u.getUsername()));
        return requests.stream().map(request -> toVO(request, names)).toList();
    }

    private static long aiFieldCount(List<Map<String, Object>> details) {
        return details.stream().filter(row -> SosFieldMapping.SOURCE_AI.equals(row.get("ruleSource"))).count();
    }

    private static String displayName(SecurityUser user) {
        return user.getUsername();
    }

    private SosReport requireParsed(String tenantId, Long reportId) {
        SosReport report = requireReport(tenantId, reportId);
        if (!SosReport.STATUS_PARSED.equals(report.getStatus())) {
            throw new BusinessException(HttpStatus.CONFLICT, "SOS_REPORT_NOT_PARSED", "报告尚未解析成功");
        }
        return report;
    }

    private SosReport requireReport(String tenantId, Long reportId) {
        SosReport report = reportMapper.selectOne(new LambdaQueryWrapper<SosReport>()
            .eq(SosReport::getTenantId, tenantId)
            .eq(SosReport::getId, reportId));
        if (report == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "SOS_REPORT_NOT_FOUND", "SOS 报告不存在");
        }
        return report;
    }

    private static CmdbRequestVO toVO(SosCmdbRequest request, Map<Long, String> names) {
        CmdbRequestVO vo = new CmdbRequestVO();
        vo.setId(request.getId());
        vo.setReportId(request.getReportId());
        vo.setModelCode(request.getModelCode());
        vo.setAction(request.getAction());
        vo.setTargetInstanceId(request.getTargetInstanceId());
        vo.setInstanceName(request.getInstanceName());
        vo.setProposedFields(request.getProposedFields());
        vo.setFieldDetails(request.getFieldDetails());
        vo.setStatus(request.getStatus());
        vo.setResultInstanceId(request.getResultInstanceId());
        vo.setFailureMessage(request.getFailureMessage());
        vo.setProcessInstanceId(request.getProcessInstanceId());
        vo.setSubmitterId(request.getSubmitterId());
        vo.setSubmitterName(names.get(request.getSubmitterId()));
        vo.setDecidedBy(request.getDecidedBy());
        vo.setDecidedAt(request.getDecidedAt());
        vo.setDecisionComment(request.getDecisionComment());
        vo.setCreatedAt(request.getCreatedAt());
        return vo;
    }
}
