package com.cwgsyw.platform.module.sosreport.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.module.sosreport.dto.SosCmdbDtos.PendingApprovalVO;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.workflow.adapter.SosCmdbWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowTaskCompleteCommand;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowTaskSummary;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * SOS 入库申请的审批入口。
 *
 * <p>系统目前没有通用的待办中心，{@link WorkflowRuntimeFacade} 的任务查询和完成方法也没有接口，
 * 所以这里只为本业务类型提供入口。候选关系和业务权限仍由 Facade 和适配器判定，这里不重复实现。
 */
@Service
@RequiredArgsConstructor
public class SosCmdbApprovalService {

    private static final int MAX_COMMENT = 500;

    private final WorkflowRuntimeFacade workflowRuntimeFacade;
    private final SosCmdbRequestMapper requestMapper;
    private final ApplicationEventPublisher eventPublisher;

    public List<PendingApprovalVO> pending(SecurityUser user) {
        Map<Long, WorkflowTaskSummary> tasks = approvableTasks(user);
        if (tasks.isEmpty()) return List.of();
        return requestMapper.selectList(new LambdaQueryWrapper<SosCmdbRequest>()
                .eq(SosCmdbRequest::getTenantId, user.getTenantId())
                .eq(SosCmdbRequest::getStatus, SosCmdbRequest.STATUS_PENDING)
                .in(SosCmdbRequest::getId, tasks.keySet())
                .orderByDesc(SosCmdbRequest::getCreatedAt))
            .stream().map(request -> toVO(request, tasks.get(request.getId()))).toList();
    }

    @Transactional
    public void decide(SecurityUser user, Long requestId, Boolean approved, String comment) {
        if (approved == null) {
            throw BusinessException.badRequest("SOS_CMDB_DECISION_REQUIRED", "请选择通过或驳回");
        }
        String reason = comment == null ? null : comment.trim();
        if (!approved && (reason == null || reason.isEmpty())) {
            throw BusinessException.badRequest("SOS_CMDB_REASON_REQUIRED", "驳回时请填写原因");
        }
        if (reason != null && reason.length() > MAX_COMMENT) {
            throw BusinessException.badRequest("SOS_CMDB_REASON_TOO_LONG", "意见不能超过 500 字");
        }

        SosCmdbRequest request = requestMapper.selectOne(new LambdaQueryWrapper<SosCmdbRequest>()
            .eq(SosCmdbRequest::getTenantId, user.getTenantId())
            .eq(SosCmdbRequest::getId, requestId));
        if (request == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "SOS_CMDB_REQUEST_NOT_FOUND", "入库申请不存在");
        }
        if (!SosCmdbRequest.STATUS_PENDING.equals(request.getStatus())) {
            throw new BusinessException(HttpStatus.CONFLICT, "SOS_CMDB_ALREADY_DECIDED", "该申请已处理");
        }
        WorkflowTaskSummary task = approvableTasks(user).get(requestId);
        if (task == null) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "SOS_CMDB_NOT_APPROVER", "您不是这个申请的审批人");
        }

        workflowRuntimeFacade.completeTask(WorkflowTaskCompleteCommand.builder()
            .tenantId(user.getTenantId())
            .taskId(task.getTaskId())
            .operatorId(user.getUserId())
            .approved(approved)
            .comment(reason)
            .build());
        // 多级审批时，下一级任务在这里才生成，提交后再通知下一级审批人。
        eventPublisher.publishEvent(new SosApprovalTasksChangedEvent(user.getTenantId(), requestId));
    }

    /** 当前用户能审批的任务，按申请 id 索引。Flowable 查询不区分租户，canApprove 含租户校验。 */
    private Map<Long, WorkflowTaskSummary> approvableTasks(SecurityUser user) {
        Map<Long, WorkflowTaskSummary> tasks = new LinkedHashMap<>();
        workflowRuntimeFacade.listMyTasks(user).stream()
            .filter(task -> SosCmdbWorkflowAdapter.BUSINESS_TYPE.equals(task.getBusinessType()))
            .filter(WorkflowTaskSummary::isCanApprove)
            .filter(task -> isNumeric(task.getBusinessId()))
            .forEach(task -> tasks.putIfAbsent(Long.valueOf(task.getBusinessId()), task));
        return tasks;
    }

    private static boolean isNumeric(String value) {
        return value != null && value.matches("\\d{1,18}");
    }

    private static PendingApprovalVO toVO(SosCmdbRequest request, WorkflowTaskSummary task) {
        PendingApprovalVO vo = new PendingApprovalVO();
        vo.setRequestId(request.getId());
        vo.setReportId(request.getReportId());
        vo.setTaskName(task.getTaskName());
        vo.setAction(request.getAction());
        vo.setTargetInstanceId(request.getTargetInstanceId());
        vo.setInstanceName(request.getInstanceName());
        vo.setModelCode(request.getModelCode());
        vo.setProposedFields(request.getProposedFields());
        vo.setFieldDetails(request.getFieldDetails());
        vo.setSubmitterName(task.getSubmitterName());
        vo.setCreatedAt(request.getCreatedAt());
        return vo;
    }
}
