package com.cwgsyw.platform.module.workflow.template;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.workflow.binding.ProcessBindingService;
import com.cwgsyw.platform.module.workflow.template.dto.CreateTemplateInstanceRequest;
import com.cwgsyw.platform.module.workflow.template.dto.TemplateInstanceVO;
import com.cwgsyw.platform.module.workflow.template.model.TemplateDefinition;
import com.cwgsyw.platform.module.workflow.template.model.TemplateInstanceConfig;
import com.cwgsyw.platform.module.workflow.template.model.WorkflowTemplateInstance;
import com.cwgsyw.platform.module.workflow.template.model.WorkflowTemplateInstanceMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.repository.Deployment;
import org.flowable.engine.repository.ProcessDefinition;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * 流程模板服务：列出内置模板、创建模板实例（生成 BPMN + 部署 + 落库 + 可选绑定）。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WorkflowTemplateService {

    private final BpmnTemplateGenerator generator;
    private final BpmnValidationService validationService;
    private final RepositoryService repositoryService;
    private final ProcessBindingService bindingService;
    private final WorkflowTemplateInstanceMapper instanceMapper;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    /** 列出所有内置模板定义（供前端渲染配置表单）。 */
    public List<TemplateDefinition> listTemplates() {
        return BuiltinTemplates.all();
    }

    /** 列出租户下的模板实例。 */
    public List<TemplateInstanceVO> listInstances(String tenantId) {
        return instanceMapper.selectList(new LambdaQueryWrapper<WorkflowTemplateInstance>()
                .eq(WorkflowTemplateInstance::getTenantId, tenantId)
                .eq(WorkflowTemplateInstance::getIsDeleted, false)
                .orderByDesc(WorkflowTemplateInstance::getCreatedAt))
            .stream().map(this::toVO).toList();
    }

    /**
     * 创建模板实例：校验配置 -> 生成 BPMN -> 部署 -> 落库 -> 可选绑定。
     */
    @Transactional
    public TemplateInstanceVO createInstance(String tenantId, Long operatorId, CreateTemplateInstanceRequest req) {
        TemplateInstanceConfig config = TemplateInstanceConfig.builder()
            .templateCode(req.getTemplateCode())
            .name(req.getName())
            .processKey(req.getProcessKey())
            .businessType(req.getBusinessType())
            .description(req.getDescription())
            .configValues(req.getConfigValues() != null ? req.getConfigValues() : Map.of())
            .build();

        // 1. 校验配置
        validationService.validate(config);

        // 2. 流程 key 冲突校验（租户内唯一，且 Flowable 全局 key 不冲突）
        long existing = instanceMapper.selectCount(new LambdaQueryWrapper<WorkflowTemplateInstance>()
            .eq(WorkflowTemplateInstance::getTenantId, tenantId)
            .eq(WorkflowTemplateInstance::getProcessKey, req.getProcessKey())
            .eq(WorkflowTemplateInstance::getIsDeleted, false));
        if (existing > 0) {
            throw new IllegalArgumentException("流程 key 已存在: " + req.getProcessKey());
        }

        // 3. 生成 BPMN
        String xml = generator.generate(config);

        // 4. 部署到 Flowable
        String resourceName = req.getProcessKey() + ".bpmn20.xml";
        Deployment deployment;
        try {
            deployment = repositoryService.createDeployment()
                .name(req.getName())
                .category("template:" + req.getTemplateCode())
                .addString(resourceName, xml)
                .deploy();
        } catch (Exception e) {
            log.error("模板实例部署失败 key={}: {}", req.getProcessKey(), e.getMessage(), e);
            throw new IllegalStateException("流程部署失败: " + e.getMessage(), e);
        }
        ProcessDefinition def = repositoryService.createProcessDefinitionQuery()
            .deploymentId(deployment.getId()).singleResult();

        // 5. 落库
        LocalDateTime now = LocalDateTime.now();
        WorkflowTemplateInstance instance = new WorkflowTemplateInstance();
        instance.setTenantId(tenantId);
        instance.setTemplateCode(req.getTemplateCode());
        instance.setName(req.getName());
        instance.setProcessKey(req.getProcessKey());
        instance.setBusinessType(req.getBusinessType());
        instance.setDescription(req.getDescription());
        instance.setConfig(toJson(config.getConfigValues()));
        instance.setLatestProcessDefinitionId(def.getId());
        instance.setLatestVersion(def.getVersion());
        instance.setStatus("active");
        instance.setCreatedBy(operatorId);
        instance.setCreatedAt(now);
        instance.setUpdatedBy(operatorId);
        instance.setUpdatedAt(now);
        instance.setIsDeleted(false);
        instanceMapper.insert(instance);

        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId).module("workflow").action("create_template_instance")
            .targetType("workflow_template_instance").targetId(instance.getId())
            .operatorId(operatorId)
            .afterJson("{\"processKey\":\"" + req.getProcessKey() + "\",\"defId\":\"" + def.getId() + "\"}")
            .remark("创建模板实例 " + req.getName() + " (" + req.getTemplateCode() + ")")
            .createdAt(now).build());

        // 6. 可选立即绑定
        if (req.isBindNow()) {
            bindingService.bind(tenantId, req.getBusinessType(), def.getId(),
                instance.getId(), operatorId, "创建模板实例时绑定");
        }

        return toVO(instance);
    }

    private TemplateInstanceVO toVO(WorkflowTemplateInstance i) {
        TemplateInstanceVO vo = new TemplateInstanceVO();
        vo.setId(i.getId());
        vo.setTemplateCode(i.getTemplateCode());
        vo.setName(i.getName());
        vo.setProcessKey(i.getProcessKey());
        vo.setBusinessType(i.getBusinessType());
        vo.setDescription(i.getDescription());
        vo.setLatestProcessDefinitionId(i.getLatestProcessDefinitionId());
        vo.setLatestVersion(i.getLatestVersion());
        vo.setStatus(i.getStatus());
        vo.setCreatedAt(i.getCreatedAt());
        return vo;
    }

    private String toJson(Object o) {
        try {
            return objectMapper.writeValueAsString(o);
        } catch (Exception e) {
            return "{}";
        }
    }
}
