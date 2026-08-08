package com.cwgsyw.platform.module.task.template;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlan;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.template.dto.UpdateTaskTemplateVersionRequest;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateField;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateVersion;
import com.cwgsyw.platform.module.task.template.form.FieldTypeRegistry;
import com.cwgsyw.platform.module.task.template.form.ExpressionEngine;
import com.cwgsyw.platform.module.task.template.form.TemplateFormRuntime;
import com.cwgsyw.platform.module.task.template.form.TemplateSchemaValidator;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateFieldMapper;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateMapper;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateVersionMapper;
import com.cwgsyw.platform.module.task.plan.mapper.TaskPlanMapper;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import com.cwgsyw.platform.module.task.template.service.impl.TaskTemplateServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskTemplateServiceLifecycleTest {
    @Mock TaskTemplateMapper templateMapper;
    @Mock TaskTemplateVersionMapper versionMapper;
    @Mock TaskTemplateFieldMapper fieldMapper;
    @Mock TaskInstanceMapper taskInstanceMapper;
    @Mock TaskPlanMapper taskPlanMapper;
    private TemplateSchemaValidator schemaValidator;
    private TemplateFormRuntime formRuntime;
    private TaskTemplateServiceImpl service;

    @BeforeEach
    void setUp() {
        MybatisConfiguration configuration = new MybatisConfiguration();
        TableInfoHelper.initTableInfo(
            new MapperBuilderAssistant(configuration, "taskTemplateServiceLifecycleTest"),
            TaskPlan.class);
        TableInfoHelper.initTableInfo(
            new MapperBuilderAssistant(configuration, "taskTemplateServiceLifecycleTest"),
            TaskInstance.class);
        FieldTypeRegistry registry = new FieldTypeRegistry();
        ExpressionEngine expressionEngine = new ExpressionEngine();
        schemaValidator = new TemplateSchemaValidator(registry, expressionEngine);
        formRuntime = new TemplateFormRuntime(registry, expressionEngine);
        service = new TaskTemplateServiceImpl(
            versionMapper, fieldMapper, taskInstanceMapper, taskPlanMapper, schemaValidator, formRuntime, registry);
    }

    @Test
    void publishedVersionUpdateReturnsConflictBeforeAnyWrite() {
        TaskTemplateVersion published = version(7L, "published");
        when(versionMapper.selectOne(any())).thenReturn(published);
        UpdateTaskTemplateVersionRequest request = new UpdateTaskTemplateVersionRequest();
        request.setName("modified");

        assertThatThrownBy(() -> service.updateVersion("tenant-a", 9L, 7L, request))
            .isInstanceOf(TaskTemplateException.class)
            .satisfies(error -> org.assertj.core.api.Assertions.assertThat(((TaskTemplateException) error).getErrorCode())
                .isEqualTo("PUBLISHED_VERSION_IMMUTABLE"));

        verify(versionMapper, never()).updateById(any(TaskTemplateVersion.class));
        verify(fieldMapper, never()).delete(any(Wrapper.class));
        verify(fieldMapper, never()).insert(any(TaskTemplateField.class));
    }

    @Test
    void invalidDraftPublishHasZeroWrites() {
        TaskTemplateVersion draft = version(8L, "draft");
        when(versionMapper.selectOne(any())).thenReturn(draft);
        TaskTemplateField invalidFormula = new TaskTemplateField();
        invalidFormula.setId(10L);
        invalidFormula.setTenantId("tenant-a");
        invalidFormula.setTemplateVersionId(8L);
        invalidFormula.setFieldKey("result");
        invalidFormula.setLabel("result");
        invalidFormula.setFieldType("formula");
        invalidFormula.setFormulaConfig(java.util.Map.of(
            "op", "ADD", "args", List.of(java.util.Map.of("field", "missing"))));
        when(fieldMapper.selectList(any())).thenReturn(List.of(invalidFormula));

        assertThatThrownBy(() -> service.publishVersion("tenant-a", 9L, 8L))
            .isInstanceOf(TaskTemplateException.class)
            .satisfies(error -> org.assertj.core.api.Assertions.assertThat(((TaskTemplateException) error).getErrorCode())
                .isEqualTo("TEMPLATE_VALIDATION_FAILED"));

        verify(versionMapper, never()).updateById(any(TaskTemplateVersion.class));
    }

    @Test
    void taskOrPlanUsagePreventsTemplateDeletion() {
        TaskTemplateVersion version = version(8L, "published");
        when(taskInstanceMapper.selectCount(any())).thenReturn(1L);

        assertThat(isUsedByTasksOrPlans(version)).isTrue();

        verify(taskPlanMapper, never()).selectCount(any());
    }

    @Test
    void planUsagePreventsTemplateDeletion() {
        TaskTemplateVersion version = version(8L, "published");
        when(taskInstanceMapper.selectCount(any())).thenReturn(0L);
        when(taskPlanMapper.selectCount(any())).thenReturn(1L);

        assertThat(isUsedByTasksOrPlans(version)).isTrue();
    }

    private TaskTemplateVersion version(Long id, String status) {
        TaskTemplateVersion version = new TaskTemplateVersion();
        version.setId(id);
        version.setTenantId("tenant-a");
        version.setTemplateId(2L);
        version.setStatus(status);
        return version;
    }

    private boolean isUsedByTasksOrPlans(TaskTemplateVersion version) {
        return ReflectionTestUtils.invokeMethod(service, "isUsedByTasksOrPlans", "tenant-a", List.of(version));
    }
}
