package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocTemplate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ChangeDocTemplateLifecycleTest {
    @Mock ChangeDocTemplateMapper templateMapper;
    @Mock ChangeDocFieldMapper fieldMapper;
    @Mock ChangeDocMapper changeDocMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock MinioStorageService storage;
    @Mock TableFieldSupport tableFieldSupport;

    @InjectMocks ChangeDocTemplateService service;

    @Test
    void cloneTemplate_copiesFieldsAndDocxToNewTemplate() {
        ChangeDocTemplate source = template(7L, "source.docx");
        ChangeDocField field = field("priority", "enum", Map.of("options", List.of(Map.of("value", "high", "label", "高"))));
        when(templateMapper.selectOne(any())).thenReturn(source);
        when(fieldMapper.findByTemplate(7L)).thenReturn(List.of(field));
        doAnswer(invocation -> {
            ChangeDocTemplate inserted = invocation.getArgument(0);
            inserted.setId(8L);
            return 1;
        }).when(templateMapper).insert(any(ChangeDocTemplate.class));

        var result = service.cloneTemplate("default", 1L, 7L, "copy");

        assertThat(result.getId()).isEqualTo(8L);
        verify(storage).copyOrThrow("source.docx", "templates/default/8/v1.docx");
        ArgumentCaptor<ChangeDocField> fieldCaptor = ArgumentCaptor.forClass(ChangeDocField.class);
        verify(fieldMapper).insert(fieldCaptor.capture());
        assertThat(fieldCaptor.getValue()).satisfies(copy -> {
            assertThat(copy.getTemplateId()).isEqualTo(8L);
            assertThat(copy.getFieldKey()).isEqualTo("priority");
            assertThat(copy.getConfig()).containsKey("options");
        });
        verify(auditLogMapper).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    @Test
    void deleteTemplate_rejectsAnyDocumentReferenceWithoutSideEffects() {
        when(templateMapper.selectOne(any())).thenReturn(template(7L, "source.docx"));
        when(changeDocMapper.countActiveReferences("default", 7L)).thenReturn(1);

        assertThatThrownBy(() -> service.deleteTemplate("default", 1L, 7L))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessage("模板已被变更文档引用，不能删除");

        verify(fieldMapper, never()).delete(any(com.baomidou.mybatisplus.core.conditions.Wrapper.class));
        verify(templateMapper, never()).deleteById(any(Long.class));
        verify(storage, never()).deleteOrThrow(any());
    }

    @Test
    void deleteTemplate_removesOnlyUnreferencedFieldsTemplateAndDocx() {
        when(templateMapper.selectOne(any())).thenReturn(template(7L, "source.docx"));
        when(changeDocMapper.countActiveReferences("default", 7L)).thenReturn(0);

        service.deleteTemplate("default", 1L, 7L);

        verify(fieldMapper).delete(any(com.baomidou.mybatisplus.core.conditions.Wrapper.class));
        verify(templateMapper).deleteById(7L);
        verify(storage).deleteOrThrow("source.docx");
        verify(auditLogMapper).insert(any(com.cwgsyw.platform.common.entity.AuditLog.class));
    }

    private ChangeDocTemplate template(Long id, String docxKey) {
        ChangeDocTemplate template = new ChangeDocTemplate();
        template.setId(id);
        template.setTenantId("default");
        template.setName("source");
        template.setDocType("general");
        template.setDocxKey(docxKey);
        return template;
    }

    private ChangeDocField field(String key, String type, Map<String, Object> config) {
        ChangeDocField field = new ChangeDocField();
        field.setFieldKey(key);
        field.setLabel(key);
        field.setFieldType(type);
        field.setSortOrder(10);
        field.setRequired(false);
        field.setInForm(true);
        field.setConfig(config);
        return field;
    }
}
