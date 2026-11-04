package com.cwgsyw.platform.module.sosreport.cmdb;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.AuditRemark;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.instance.CiInstanceDetailVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.CreateInstanceRequest;
import com.cwgsyw.platform.module.cmdb.dto.instance.UpdateInstanceRequest;
import com.cwgsyw.platform.module.cmdb.service.CiInstanceCommandService;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.sosreport.mapping.SosPresetRules;
import com.cwgsyw.platform.module.workflow.event.WorkflowCompletedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 审批结束后回写：通过时写 CMDB，驳回时只记录结果。
 *
 * <p>这里运行在审批事务内。CI 写入放到保存点（{@code PROPAGATION_NESTED}）：
 * 写入失败只回滚到保存点并把申请标记为 {@code apply_failed}，审批结果不受影响。
 * 不能直接 try/catch 调用 {@link CiInstanceCommandService}：
 * 它的 {@code @Transactional} 会把外层事务标记为 rollback-only，导致审批一起失败。
 */
@Service
@Slf4j
public class SosCmdbApplyService {

    private static final int MAX_MESSAGE = 500;

    private final SosCmdbRequestMapper requestMapper;
    private final CiInstanceCommandService instanceCommandService;
    private final AuditLogMapper auditLogMapper;
    private final NotificationService notificationService;
    private final TransactionTemplate savepointTemplate;

    public SosCmdbApplyService(SosCmdbRequestMapper requestMapper, CiInstanceCommandService instanceCommandService,
                               AuditLogMapper auditLogMapper, NotificationService notificationService,
                               PlatformTransactionManager transactionManager) {
        this.requestMapper = requestMapper;
        this.instanceCommandService = instanceCommandService;
        this.auditLogMapper = auditLogMapper;
        this.notificationService = notificationService;
        this.savepointTemplate = new TransactionTemplate(transactionManager);
        this.savepointTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_NESTED);
    }

    @Transactional
    public void complete(WorkflowCompletedEvent event) {
        Long requestId = Long.valueOf(event.getBusinessId());
        SosCmdbRequest request = requestMapper.selectOne(new LambdaQueryWrapper<SosCmdbRequest>()
            .eq(SosCmdbRequest::getTenantId, event.getTenantId())
            .eq(SosCmdbRequest::getId, requestId)
            .last("FOR UPDATE"));
        if (request == null) {
            log.warn("SOS 入库审批回调但申请不存在: requestId={}", requestId);
            return;
        }
        // 幂等：只有审批中的申请才处理，重复回调直接跳过。
        if (!SosCmdbRequest.STATUS_PENDING.equals(request.getStatus())) {
            log.info("SOS 入库申请已处理，跳过重复回调: requestId={} status={}", requestId, request.getStatus());
            return;
        }

        Long operatorId = event.getApproverId() != null ? event.getApproverId() : 0L;
        request.setDecidedBy(event.getApproverId());
        request.setDecidedAt(event.getCompletedAt() != null ? event.getCompletedAt() : LocalDateTime.now());
        request.setDecisionComment(limit(event.getComment()));

        if (!event.isApproved()) {
            request.setStatus(SosCmdbRequest.STATUS_REJECTED);
            requestMapper.updateById(request);
            audit(request, "cmdb_rejected", operatorId, AuditRemark.bounded(event.getComment()));
            notifySubmitter(request, "SOS 报告入库被驳回",
                "实例“" + request.getInstanceName() + "”的入库申请被驳回：" + nullToEmpty(event.getComment()));
            return;
        }

        try {
            Long instanceId = savepointTemplate.execute(status -> apply(request, operatorId));
            request.setStatus(SosCmdbRequest.STATUS_APPLIED);
            request.setResultInstanceId(instanceId);
            requestMapper.updateById(request);
            audit(request, "cmdb_applied", operatorId, "instanceId=" + instanceId);
            notifySubmitter(request, "SOS 报告已入库",
                "实例“" + request.getInstanceName() + "”的入库申请已通过并写入 CMDB。");
        } catch (RuntimeException e) {
            String message = limit(e.getMessage() == null ? "写入 CMDB 失败" : e.getMessage());
            log.warn("SOS 入库写入 CMDB 失败: requestId={} error={}", requestId, e.getClass().getSimpleName());
            request.setStatus(SosCmdbRequest.STATUS_APPLY_FAILED);
            request.setFailureMessage(message);
            requestMapper.updateById(request);
            audit(request, "cmdb_apply_failed", operatorId, message);
            notifySubmitter(request, "SOS 报告入库失败",
                "实例“" + request.getInstanceName() + "”审批已通过，但写入 CMDB 失败：" + message);
        }
    }

    private Long apply(SosCmdbRequest request, Long operatorId) {
        String tenantId = request.getTenantId();
        Map<String, Object> fields = new LinkedHashMap<>(request.getProposedFields());
        Object identity = fields.get(SosPresetRules.FIELD_SN);
        // CMDB 唯一性只在应用层检查。串行化同一身份的并发审批，避免都通过检查后写出重复 CI。
        requestMapper.lockIdentity("sos-cmdb:" + tenantId + ":" + (identity != null ? identity : request.getInstanceName()));

        if (SosCmdbRequest.ACTION_CREATE.equals(request.getAction())) {
            CreateInstanceRequest create = new CreateInstanceRequest();
            create.setModelId(request.getModelCode());
            create.setName(request.getInstanceName());
            create.setFieldsData(fields);
            CiInstanceDetailVO detail = instanceCommandService.create(create, tenantId, operatorId);
            return detail.getId();
        }
        UpdateInstanceRequest update = new UpdateInstanceRequest();
        update.setName(request.getInstanceName());
        update.setFieldsData(fields);
        instanceCommandService.update(request.getTargetInstanceId(), update, tenantId, operatorId);
        return request.getTargetInstanceId();
    }

    private void audit(SosCmdbRequest request, String action, Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(request.getTenantId()).module("sos_report").action(action)
            .targetId(request.getId()).targetType("sos_cmdb_request")
            .operatorId(operatorId).remark(remark)
            .createdAt(LocalDateTime.now()).build());
    }

    private void notifySubmitter(SosCmdbRequest request, String title, String body) {
        notificationService.notify(request.getTenantId(), request.getSubmitterId(), title, body,
            "sos_cmdb_request", "sos_report", request.getReportId());
    }

    private static String limit(String value) {
        if (value == null) return null;
        return value.length() > MAX_MESSAGE ? value.substring(0, MAX_MESSAGE) : value;
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }
}
