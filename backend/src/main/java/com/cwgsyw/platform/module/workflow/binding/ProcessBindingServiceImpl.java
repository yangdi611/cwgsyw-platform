package com.cwgsyw.platform.module.workflow.binding;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.workflow.template.model.WorkflowTemplateInstance;
import com.cwgsyw.platform.module.workflow.template.model.WorkflowTemplateInstanceMapper;
import com.cwgsyw.platform.common.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.repository.ProcessDefinition;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.List;

/**
 * {@link ProcessBindingService} 实现。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ProcessBindingServiceImpl implements ProcessBindingService {

    private final WorkflowProcessBindingMapper bindingMapper;
    private final WorkflowTemplateInstanceMapper templateInstanceMapper;
    private final RepositoryService repositoryService;
    private final AuditLogMapper auditLogMapper;

    @Override
    public WorkflowProcessBinding getActiveBinding(String tenantId, String businessType) {
        WorkflowProcessBinding binding = bindingMapper.selectOne(new LambdaQueryWrapper<WorkflowProcessBinding>()
            .eq(WorkflowProcessBinding::getTenantId, tenantId)
            .eq(WorkflowProcessBinding::getBusinessType, businessType)
            .eq(WorkflowProcessBinding::getEnabled, true)
            .last("LIMIT 1"));
        if (binding != null) {
            return Boolean.TRUE.equals(binding.getEnabled()) ? binding : null;
        }
        return null;
    }

    @Override
    public boolean hasBindingHistory(String tenantId, String businessType) {
        return bindingMapper.countIncludingDeleted(tenantId, businessType) > 0;
    }

    @Override
    @Transactional
    public WorkflowProcessBinding bind(String tenantId, String businessType, String processDefinitionId,
                                       Long templateInstanceId, Long operatorId, String remark) {
        validateBindable(tenantId, businessType, processDefinitionId);
        ProcessDefinition def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(processDefinitionId)
            .singleResult();

        WorkflowProcessBinding existing = bindingMapper.selectOne(new LambdaQueryWrapper<WorkflowProcessBinding>()
            .eq(WorkflowProcessBinding::getTenantId, tenantId)
            .eq(WorkflowProcessBinding::getBusinessType, businessType)
            .last("LIMIT 1"));

        String beforeJson = existing != null
            ? "{\"processDefinitionId\":\"" + existing.getProcessDefinitionId() + "\"}"
            : null;

        LocalDateTime now = LocalDateTime.now();
        WorkflowProcessBinding binding = existing != null ? existing : new WorkflowProcessBinding();
        binding.setTenantId(tenantId);
        binding.setBusinessType(businessType);
        binding.setProcessDefinitionId(def.getId());
        binding.setProcessDefinitionKey(def.getKey());
        binding.setProcessDefinitionVersion(def.getVersion());
        binding.setTemplateInstanceId(templateInstanceId);
        binding.setEnabled(true);
        binding.setUpdatedBy(operatorId);
        binding.setUpdatedAt(now);
        if (binding.getId() == null) {
            binding.setCreatedBy(operatorId);
            binding.setCreatedAt(now);
            bindingMapper.insert(binding);
        } else {
            bindingMapper.updateById(binding);
        }

        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("workflow")
            .action("bind_process")
            .targetType("workflow_process_binding")
            .targetId(binding.getId())
            .operatorId(operatorId)
            .beforeJson(beforeJson)
            .afterJson("{\"processDefinitionId\":\"" + def.getId() + "\"}")
            .remark("绑定业务流程 " + businessType + " -> " + def.getId()
                + (remark != null ? " (" + remark + ")" : ""))
            .createdAt(now)
            .build());
        return binding;
    }

    @Override
    @Transactional
    public WorkflowProcessBinding enable(String tenantId, Long bindingId, Long operatorId) {
        WorkflowProcessBinding binding = requireBinding(tenantId, bindingId);
        if (Boolean.TRUE.equals(binding.getEnabled())) return binding;
        validateBindable(tenantId, binding.getBusinessType(), binding.getProcessDefinitionId());
        String beforeJson = snapshot(binding);
        binding.setEnabled(true);
        binding.setUpdatedBy(operatorId);
        binding.setUpdatedAt(LocalDateTime.now());
        bindingMapper.updateById(binding);
        writeAudit(binding, operatorId, "enable_binding", beforeJson, snapshot(binding));
        return binding;
    }

    @Override
    @Transactional
    public WorkflowProcessBinding disable(String tenantId, Long bindingId, Long operatorId) {
        WorkflowProcessBinding binding = requireBinding(tenantId, bindingId);
        if (!Boolean.TRUE.equals(binding.getEnabled())) return binding;
        String beforeJson = snapshot(binding);
        binding.setEnabled(false);
        binding.setUpdatedBy(operatorId);
        binding.setUpdatedAt(LocalDateTime.now());
        bindingMapper.updateById(binding);
        writeAudit(binding, operatorId, "disable_binding", beforeJson, snapshot(binding));
        return binding;
    }

    @Override
    @Transactional
    public void delete(String tenantId, Long bindingId, Long operatorId) {
        WorkflowProcessBinding binding = requireBinding(tenantId, bindingId);
        String beforeJson = snapshot(binding);
        binding.setEnabled(false);
        binding.setDeletedAt(LocalDateTime.now());
        binding.setDeletedBy(operatorId);
        binding.setUpdatedBy(operatorId);
        binding.setUpdatedAt(binding.getDeletedAt());
        bindingMapper.updateById(binding);
        bindingMapper.deleteById(bindingId);
        writeAudit(binding, operatorId, "delete_binding", beforeJson, snapshot(binding));
    }

    @Override
    public List<WorkflowProcessBinding> listBindings(String tenantId) {
        return bindingMapper.selectList(new LambdaQueryWrapper<WorkflowProcessBinding>()
            .eq(WorkflowProcessBinding::getTenantId, tenantId)
            .orderByAsc(WorkflowProcessBinding::getBusinessType));
    }

    private WorkflowProcessBinding requireBinding(String tenantId, Long bindingId) {
        WorkflowProcessBinding binding = bindingMapper.selectOne(new LambdaQueryWrapper<WorkflowProcessBinding>()
            .eq(WorkflowProcessBinding::getTenantId, tenantId)
            .eq(WorkflowProcessBinding::getId, bindingId));
        if (binding == null) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "WORKFLOW_BINDING_NOT_FOUND", "流程绑定不存在");
        }
        return binding;
    }

    private String snapshot(WorkflowProcessBinding binding) {
        return "{\"businessType\":\"" + binding.getBusinessType()
            + "\",\"processDefinitionId\":\"" + binding.getProcessDefinitionId()
            + "\",\"enabled\":" + binding.getEnabled() + "}";
    }

    private void writeAudit(WorkflowProcessBinding binding, Long operatorId, String action,
                            String beforeJson, String afterJson) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(binding.getTenantId())
            .module("workflow")
            .action(action)
            .targetType("workflow_process_binding")
            .targetId(binding.getId())
            .operatorId(operatorId)
            .beforeJson(beforeJson)
            .afterJson(afterJson)
            .remark(action + " " + binding.getBusinessType())
            .createdAt(LocalDateTime.now())
            .build());
    }

    @Override
    public void validateBindable(String tenantId, String businessType, String processDefinitionId) {
        if (processDefinitionId == null || processDefinitionId.isBlank()) {
            throw new IllegalArgumentException("processDefinitionId 不能为空");
        }
        ProcessDefinition def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(processDefinitionId)
            .singleResult();
        if (def == null) {
            throw new IllegalArgumentException("流程定义不存在: " + processDefinitionId);
        }
        if (def.isSuspended()) {
            throw new IllegalStateException("流程定义已挂起，不能绑定: " + processDefinitionId);
        }
        // 若该流程定义来自模板实例，校验模板业务类型与目标业务类型一致
        WorkflowTemplateInstance ti = templateInstanceMapper.selectOne(
            new LambdaQueryWrapper<WorkflowTemplateInstance>()
                .eq(WorkflowTemplateInstance::getTenantId, tenantId)
                .eq(WorkflowTemplateInstance::getProcessKey, def.getKey())
                .eq(WorkflowTemplateInstance::getIsDeleted, false)
                .last("LIMIT 1"));
        if (ti != null) {
            if (!businessType.equals(ti.getBusinessType())) {
                throw new IllegalStateException("模板实例业务类型 " + ti.getBusinessType()
                    + " 与绑定目标 " + businessType + " 不一致");
            }
            if ("deprecated".equals(ti.getStatus()) || "deleted".equals(ti.getStatus())) {
                throw new IllegalStateException("模板实例已废弃/删除，不能绑定: " + ti.getName());
            }
        }
    }
}
