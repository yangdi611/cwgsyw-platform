package com.cwgsyw.platform.module.workflow.template;

import com.cwgsyw.platform.module.workflow.template.model.TemplateDefinition;
import com.cwgsyw.platform.module.workflow.template.model.TemplateInstanceConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 模板配置与流程 key 校验。
 */
@Service
@RequiredArgsConstructor
public class BpmnValidationService {

    /** BPMN process id 命名规则：字母开头，字母数字下划线连字符，避免非法 id 部署失败。 */
    private static final Pattern PROCESS_KEY = Pattern.compile("^[A-Za-z][A-Za-z0-9_-]{2,63}$");

    /**
     * 校验模板实例配置。失败抛 {@link IllegalArgumentException}，附可读原因。
     */
    public void validate(TemplateInstanceConfig config) {
        if (config == null) {
            throw new IllegalArgumentException("配置不能为空");
        }
        TemplateDefinition def = BuiltinTemplates.find(config.getTemplateCode())
            .orElseThrow(() -> new IllegalArgumentException("未知模板类型: " + config.getTemplateCode()));
        if (!def.isEnabled()) {
            throw new IllegalArgumentException("模板已禁用: " + config.getTemplateCode());
        }

        if (config.getProcessKey() == null || !PROCESS_KEY.matcher(config.getProcessKey()).matches()) {
            throw new IllegalArgumentException(
                "流程 key 非法，需字母开头、3-64 位字母数字下划线连字符: " + config.getProcessKey());
        }
        if (config.getName() == null || config.getName().isBlank()) {
            throw new IllegalArgumentException("流程名称不能为空");
        }
        if (config.getBusinessType() == null || config.getBusinessType().isBlank()) {
            throw new IllegalArgumentException("业务类型不能为空");
        }
        // 业务类型受支持性校验（空列表表示不限制）
        List<String> supported = def.getSupportedBusinessTypes();
        if (supported != null && !supported.isEmpty() && !supported.contains(config.getBusinessType())) {
            throw new IllegalArgumentException(
                "模板 " + def.getCode() + " 不支持业务类型 " + config.getBusinessType());
        }

        // 逐项校验必填配置
        Map<String, String> values = config.getConfigValues() != null ? config.getConfigValues() : Map.of();
        for (TemplateDefinition.TemplateConfigField field : def.getConfigSchema()) {
            String v = values.get(field.getKey());
            if (field.isRequired() && (v == null || v.isBlank())) {
                throw new IllegalArgumentException("缺少必填配置项: " + field.getLabel() + " (" + field.getKey() + ")");
            }
        }
    }
}
