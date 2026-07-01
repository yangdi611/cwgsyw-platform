package com.cwgsyw.platform.module.workflow.adapter;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 业务适配器注册表。
 *
 * <p>启动时收集所有 {@link BusinessWorkflowAdapter} bean，按 businessType 建索引。
 * businessType 重复会在启动阶段直接抛错，避免运行时歧义。
 */
@Component
@Slf4j
public class BusinessWorkflowAdapterRegistry {

    private final List<BusinessWorkflowAdapter> adapters;
    private final Map<String, BusinessWorkflowAdapter> byType = new HashMap<>();

    public BusinessWorkflowAdapterRegistry(List<BusinessWorkflowAdapter> adapters) {
        this.adapters = adapters;
    }

    @PostConstruct
    void init() {
        for (BusinessWorkflowAdapter adapter : adapters) {
            String type = adapter.businessType();
            if (type == null || type.isBlank()) {
                throw new IllegalStateException(
                    "BusinessWorkflowAdapter " + adapter.getClass().getName() + " 的 businessType 不能为空");
            }
            BusinessWorkflowAdapter existing = byType.putIfAbsent(type, adapter);
            if (existing != null) {
                throw new IllegalStateException("businessType 重复注册: " + type
                    + " -> " + existing.getClass().getName() + " / " + adapter.getClass().getName());
            }
        }
        log.info("已注册业务流程适配器: {}", byType.keySet());
    }

    /** 查找 adapter，未注册返回空。 */
    public Optional<BusinessWorkflowAdapter> find(String businessType) {
        return Optional.ofNullable(byType.get(businessType));
    }

    /** 查找 adapter，未注册抛错。用于启动/回调等必须存在 adapter 的场景。 */
    public BusinessWorkflowAdapter require(String businessType) {
        BusinessWorkflowAdapter adapter = byType.get(businessType);
        if (adapter == null) {
            throw new IllegalArgumentException("未注册的业务流程类型: " + businessType);
        }
        return adapter;
    }
}
