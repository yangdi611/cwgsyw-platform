package com.cwgsyw.platform.config;

import com.cwgsyw.platform.module.workflow.WorkflowGlobalListener;
import org.flowable.spring.boot.EngineConfigurationConfigurer;
import org.flowable.spring.SpringProcessEngineConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FlowableConfig {

    /**
     * Register global event listener so ALL process completions (from any
     * process definition) can trigger business logic — no hardcoded BPMN
     * execution listener required.
     */
    @Bean
    public EngineConfigurationConfigurer<SpringProcessEngineConfiguration> globalListenerConfigurer(
            WorkflowGlobalListener listener) {
        return config -> config.getEventDispatcher().addEventListener(listener);
    }
}
