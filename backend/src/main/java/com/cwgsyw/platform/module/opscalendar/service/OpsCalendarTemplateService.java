package com.cwgsyw.platform.module.opscalendar.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.opscalendar.dto.TemplateRequest;
import com.cwgsyw.platform.module.opscalendar.dto.TemplateVO;
import com.cwgsyw.platform.module.opscalendar.entity.OpsScheduleTemplate;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsScheduleTemplateMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 运维日历模板管理（通知模板 / SOP 检查项模板），spec §10 / PRD 11.3。
 * 写操作同事务写 audit_log（targetType=ops_schedule_template）。
 */
@Service
@RequiredArgsConstructor
public class OpsCalendarTemplateService {

    private final OpsScheduleTemplateMapper templateMapper;
    private final AuditLogMapper auditLogMapper;

    public List<TemplateVO> list(String tenantId, String templateType) {
        return templateMapper.selectList(new LambdaQueryWrapper<OpsScheduleTemplate>()
                        .eq(OpsScheduleTemplate::getTenantId, tenantId)
                        .eq(notBlank(templateType), OpsScheduleTemplate::getTemplateType, templateType)
                        .orderByDesc(OpsScheduleTemplate::getCreatedAt))
                .stream().map(this::toVO).collect(Collectors.toList());
    }

    @Transactional
    public Long create(String tenantId, Long operatorId, TemplateRequest req) {
        if (!notBlank(req.getName())) throw new IllegalArgumentException("模板名称必填");
        if (!notBlank(req.getTemplateType())) throw new IllegalArgumentException("模板类型必填");
        OpsScheduleTemplate t = new OpsScheduleTemplate();
        t.setTenantId(tenantId);
        apply(t, req);
        t.setEnabled(req.getEnabled() == null || req.getEnabled());
        t.setIsBuiltin(false);
        templateMapper.insert(t);
        writeAudit(tenantId, "create", t.getId(), operatorId, "name=" + t.getName());
        return t.getId();
    }

    @Transactional
    public void update(String tenantId, Long operatorId, Long id, TemplateRequest req) {
        OpsScheduleTemplate t = templateMapper.selectById(id);
        if (t == null || !tenantId.equals(t.getTenantId())) throw new IllegalArgumentException("模板不存在");
        apply(t, req);
        if (req.getEnabled() != null) t.setEnabled(req.getEnabled());
        templateMapper.updateById(t);
        writeAudit(tenantId, "update", id, operatorId, "name=" + t.getName());
    }

    @Transactional
    public void delete(String tenantId, Long operatorId, Long id) {
        OpsScheduleTemplate t = templateMapper.selectById(id);
        if (t == null || !tenantId.equals(t.getTenantId())) throw new IllegalArgumentException("模板不存在");
        if (Boolean.TRUE.equals(t.getIsBuiltin())) throw new IllegalArgumentException("内置模板不可删除");
        t.setDeletedAt(LocalDateTime.now());
        t.setDeletedBy(operatorId);
        templateMapper.updateById(t);
        templateMapper.deleteById(id);
        writeAudit(tenantId, "delete", id, operatorId, "name=" + t.getName());
    }

    private void apply(OpsScheduleTemplate t, TemplateRequest req) {
        if (notBlank(req.getName())) t.setName(req.getName());
        if (notBlank(req.getTemplateType())) t.setTemplateType(req.getTemplateType());
        t.setTaskType(req.getTaskType());
        t.setTitleTemplate(req.getTitleTemplate());
        t.setBodyTemplate(req.getBodyTemplate());
        t.setChecklistJson(req.getChecklistJson());
    }

    private TemplateVO toVO(OpsScheduleTemplate t) {
        TemplateVO vo = new TemplateVO();
        vo.setId(t.getId());
        vo.setName(t.getName());
        vo.setTemplateType(t.getTemplateType());
        vo.setTaskType(t.getTaskType());
        vo.setTitleTemplate(t.getTitleTemplate());
        vo.setBodyTemplate(t.getBodyTemplate());
        vo.setChecklistJson(t.getChecklistJson());
        vo.setEnabled(t.getEnabled());
        vo.setIsBuiltin(t.getIsBuiltin());
        vo.setCreatedAt(t.getCreatedAt());
        return vo;
    }

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("ops_calendar").action(action)
                .targetId(targetId).targetType("ops_schedule_template")
                .operatorId(operatorId).remark(remark)
                .createdAt(LocalDateTime.now()).build());
    }

    private boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
