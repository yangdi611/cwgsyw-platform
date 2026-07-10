package com.cwgsyw.platform.module.workflow.template;

import com.cwgsyw.platform.module.workflow.template.model.TemplateInstanceConfig;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BpmnValidationServiceTest {

    private final BpmnValidationService service = new BpmnValidationService();

    private TemplateInstanceConfig.TemplateInstanceConfigBuilder valid() {
        Map<String, String> values = new HashMap<>();
        values.put("approverSource", "specific_user");
        values.put("approverUserId", "42");
        values.put("taskName", "审批");
        return TemplateInstanceConfig.builder()
            .templateCode(BuiltinTemplates.SINGLE_APPROVAL)
            .name("单人审批流程")
            .processKey("myApproval")
            .businessType("change_doc")
            .configValues(values);
    }

    @Test
    void acceptsValidConfig() {
        assertThatCode(() -> service.validate(valid().build())).doesNotThrowAnyException();
    }

    @Test
    void rejectsNullConfig() {
        assertThatThrownBy(() -> service.validate(null))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsUnknownTemplate() {
        assertThatThrownBy(() -> service.validate(valid().templateCode("no_such").build()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("未知模板");
    }

    @Test
    void rejectsIllegalProcessKeyStartingWithDigit() {
        assertThatThrownBy(() -> service.validate(valid().processKey("1bad").build()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("流程 key");
    }

    @Test
    void rejectsTooShortProcessKey() {
        assertThatThrownBy(() -> service.validate(valid().processKey("ab").build()))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsProcessKeyWithIllegalChars() {
        assertThatThrownBy(() -> service.validate(valid().processKey("bad key!").build()))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsBlankName() {
        assertThatThrownBy(() -> service.validate(valid().name("  ").build()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("名称");
    }

    @Test
    void rejectsUnsupportedBusinessType() {
        // single_approval 不支持 daily_report
        assertThatThrownBy(() -> service.validate(valid().businessType("daily_report").build()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("不支持业务类型");
    }

    @Test
    void rejectsMissingRequiredConfigField() {
        Map<String, String> values = new HashMap<>();
        values.put("approverSource", "specific_user");
        // 缺少必填 approverUserId 与 taskName
        assertThatThrownBy(() -> service.validate(valid().configValues(values).build()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("必填");
    }

    @Test
    void rejectsBlankRequiredConfigValue() {
        Map<String, String> values = new HashMap<>();
        values.put("approverSource", "specific_user");
        values.put("approverUserId", "  ");
        values.put("taskName", "审批");
        assertThatThrownBy(() -> service.validate(valid().configValues(values).build()))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("必填");
    }
}
