package com.cwgsyw.platform.module.workflow.binding;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.config.SysConfigService;
import com.cwgsyw.platform.module.workflow.template.model.WorkflowTemplateInstance;
import com.cwgsyw.platform.module.workflow.template.model.WorkflowTemplateInstanceMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.repository.ProcessDefinition;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

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
    private final SysConfigService configService;
    private final AuditLogMapper auditLogMapper;

    /** businessType -> 旧 admin/config 兼容配置项 key。 */
    private static final Map<String, String> LEGACY_CONFIG_KEYS = Map.of(
        "daily_report", "daily_report_process_definition_id",
        "wiki_page", "wiki_publish_process_definition_id",
        "change_doc", "change_doc_process_definition_id",
        "device_access", "device_access_process_definition_id"
    );

    @Override
    public WorkflowProcessBinding getActiveBinding(String tenantId, String businessType) {
        WorkflowProcessBinding binding = bindingMapper.selectOne(new LambdaQueryWrapper<WorkflowProcessBinding>()
            .eq(WorkflowProcessBinding::getTenantId, tenantId)
            .eq(WorkflowProcessBinding::getBusinessType, businessType)
            .eq(WorkflowProcessBinding::getEnabled, true)
            .last("LIMIT 1"));
        if (binding != null) {
            return binding;
        }
        // 兼容：回退到旧 admin/config 配置项
        String legacyKey = LEGACY_CONFIG_KEYS.get(businessType);
        if (legacyKey == null) {
            return null;
        }
        String defId = configService.get(tenantId, legacyKey);
        if (defId == null || defId.isBlank()) {
            return null;
        }
        ProcessDefinition def = repositoryService.createProcessDefinitionQuery()
            .processDefinitionId(defId)
            .singleResult();
        if (def == null) {
            log.warn("Legacy binding config {}={} 指向的流程定义已不存在", legacyKey, defId);
            return null;
        }
        // 构造一个瞬态绑定视图（不落库）
        WorkflowProcessBinding view = new WorkflowProcessBinding();
        view.setTenantId(tenantId);
        view.setBusinessType(businessType);
        view.setProcessDefinitionId(def.getId());
        view.setProcessDefinitionKey(def.getKey());
        view.setProcessDefinitionVersion(def.getVersion());
        view.setEnabled(true);
        return view;
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

        // 同步更新旧配置项，避免尚未迁移的老逻辑短期失效
        String legacyKey = LEGACY_CONFIG_KEYS.get(businessType);
        if (legacyKey != null) {
            configService.set(tenantId, legacyKey, def.getId());
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
    public List<WorkflowProcessBinding> listBindings(String tenantId) {
        return bindingMapper.selectList(new LambdaQueryWrapper<WorkflowProcessBinding>()
            .eq(WorkflowProcessBinding::getTenantId, tenantId)
            .orderByAsc(WorkflowProcessBinding::getBusinessType));
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
