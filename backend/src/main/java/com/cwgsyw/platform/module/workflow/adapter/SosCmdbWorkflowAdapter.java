package com.cwgsyw.platform.module.workflow.adapter;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.sosreport.cmdb.SosCmdbApplyService;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.workflow.event.WorkflowCompletedEvent;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * SOS 报告入库 CMDB 的审批适配器。
 *
 * <p>businessType = {@code sos_cmdb_request}，businessId 是 {@code sos_cmdb_request.id}。
 * 流程变量只放 id，字段值保存在业务表里。
 */
@Component
@RequiredArgsConstructor
public class SosCmdbWorkflowAdapter implements BusinessWorkflowAdapter {

    public static final String BUSINESS_TYPE = "sos_cmdb_request";
    private static final String SUBMIT_PERMISSION = "sos_report:submit";
    private static final String APPROVE_PERMISSION = "sos_report:approve";

    private final SosCmdbRequestMapper requestMapper;
    private final SosCmdbApplyService applyService;
    private final UserMapper userMapper;

    @Override
    public String businessType() {
        return BUSINESS_TYPE;
    }

    @Override
    public String buildBusinessKey(String businessId) {
        return BUSINESS_TYPE + ":" + businessId;
    }

    @Override
    public Map<String, Object> buildStartVariables(BusinessWorkflowContext context) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("sosCmdbRequestId", context.getBusinessId());
        return variables;
    }

    @Override
    public BusinessWorkflowSummary buildSummary(String tenantId, String businessId, SecurityUser viewer) {
        SosCmdbRequest request = find(tenantId, businessId);
        if (request == null) {
            return BusinessWorkflowSummary.builder().available(false).build();
        }
        String actionLabel = SosCmdbRequest.ACTION_CREATE.equals(request.getAction()) ? "新增" : "更新";
        String submitterName = null;
        if (request.getSubmitterId() != null) {
            User submitter = userMapper.selectById(request.getSubmitterId());
            if (submitter != null) {
                submitterName = submitter.getRealName() != null ? submitter.getRealName() : submitter.getUsername();
            }
        }
        return BusinessWorkflowSummary.builder()
            .available(true)
            .businessType(BUSINESS_TYPE)
            .businessId(businessId)
            .businessTitle("主机入库：" + request.getInstanceName())
            .businessSummary("SOS 报告入库审批，" + actionLabel + " CMDB 主机实例“" + request.getInstanceName() + "”")
            .businessUrl("/sos-reports/" + request.getReportId())
            .submitterName(submitterName)
            .build();
    }

    /** 审批通过就会写 CMDB，所以审批人还要有对应的 CMDB 写权限。 */
    @Override
    public boolean canApprove(String tenantId, String businessId, SecurityUser user) {
        if (user == null || user.getPermissions() == null || !user.getPermissions().contains(APPROVE_PERMISSION)) {
            return false;
        }
        SosCmdbRequest request = find(tenantId, businessId);
        if (request == null) return false;
        String required = SosCmdbRequest.ACTION_CREATE.equals(request.getAction())
            ? "cmdb_instance:create" : "cmdb_instance:update";
        return user.getPermissions().contains(required);
    }

    @Override
    public boolean canSubmit(String tenantId, String businessId, SecurityUser user) {
        return user != null && user.getPermissions() != null
            && user.getPermissions().contains(SUBMIT_PERMISSION)
            && find(tenantId, businessId) != null;
    }

    @Override
    public void onWorkflowCompleted(WorkflowCompletedEvent event) {
        applyService.complete(event);
    }

    private SosCmdbRequest find(String tenantId, String businessId) {
        Long id;
        try {
            id = Long.valueOf(businessId);
        } catch (NumberFormatException e) {
            return null;
        }
        return requestMapper.selectOne(new LambdaQueryWrapper<SosCmdbRequest>()
            .eq(SosCmdbRequest::getTenantId, tenantId)
            .eq(SosCmdbRequest::getId, id));
    }
}
