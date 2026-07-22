package com.cwgsyw.platform.module.opscalendar;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTemplate;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleRuleMapper;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTemplateMapper;
import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarTemplateService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OpsCalendarTemplateServiceTest {
    @Mock OpsScheduleTemplateMapper templateMapper;
    @Mock OpsScheduleRuleMapper ruleMapper;
    @Mock AuditLogMapper auditLogMapper;
    @InjectMocks OpsCalendarTemplateService service;

    @Test
    void delete_rejectsActiveRuleReferenceWithoutSideEffects() {
        OpsScheduleTemplate template = new OpsScheduleTemplate();
        template.setId(7L);
        template.setTenantId("default");
        when(templateMapper.selectById(7L)).thenReturn(template);
        when(ruleMapper.selectCount(any(Wrapper.class))).thenReturn(1L);

        assertThatThrownBy(() -> service.delete("default", 1L, 7L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("模板已被周期规则引用，不能删除");

        verify(templateMapper, never()).updateById(any(OpsScheduleTemplate.class));
        verify(templateMapper, never()).deleteById(7L);
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }
}
