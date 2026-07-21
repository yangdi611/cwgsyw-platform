package com.cwgsyw.platform.module.changedoc;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.ai.AiGatewayService;
import com.cwgsyw.platform.module.changedoc.dto.ChangeDocVO;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.sharedfile.SharedFileService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChangeDocApprovalNotificationTest {
    @Mock ChangeDocMapper changeDocMapper;
    @Mock ChangeDocSnapshotMapper changeDocSnapshotMapper;
    @Mock ChangeDocFieldMapper changeDocFieldMapper;
    @Mock ChangeDocTemplateMapper changeDocTemplateMapper;
    @Mock ChangeDocCiLinkMapper changeDocCiLinkMapper;
    @Mock CiInstanceMapper ciInstanceMapper;
    @Mock CiModelMapper ciModelMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock AiGatewayService aiGatewayService;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;
    @Mock ObjectMapper objectMapper;
    @Mock ExportService exportService;
    @Mock SharedFileService sharedFileService;
    @Mock TableFieldSupport tableFieldSupport;
    @Mock ChangeDocLinkService changeDocLinkService;
    @Mock NotificationService notificationService;

    @InjectMocks ChangeDocService service;

    @Test
    void directRejectionNotifiesApplicantWithLongUnicodeCommentAndReference() {
        ChangeDoc doc = pendingDoc(81L, 17L);
        when(changeDocMapper.selectById(81L)).thenReturn(doc);
        when(changeDocMapper.selectForUpdate("default", 81L)).thenReturn(doc);
        String comment = "审批意见🙂".repeat(160);

        service.approve(platformUser(), 81L, comment, false);

        verify(notificationService).notify("default", 17L, "变更文档审批被拒绝",
                "《通知测试》审批被拒绝：" + comment,
                "change_doc_approval", "change_doc", 81L);
    }

    @Test
    void directApprovalNotifiesApplicantWithEmptyComment() {
        ChangeDoc doc = pendingDoc(82L, 18L);
        when(changeDocMapper.selectById(82L)).thenReturn(doc);
        when(changeDocMapper.selectForUpdate("default", 82L)).thenReturn(doc);

        service.approve(platformUser(), 82L, "", true);

        verify(notificationService).notify("default", 18L, "变更文档审批通过",
                "《通知测试》已审批通过。", "change_doc_approval", "change_doc", 82L);
    }

    @Test
    void approvedArchiveExportsEachTemplateWithItsOwnFieldConfiguration() {
        ChangeDoc doc = pendingDoc(85L, 20L);
        doc.setChangeNo("REM-P1-075");
        doc.setApplicationTemplateId(101L);
        doc.setPlanTemplateId(202L);
        when(changeDocMapper.selectById(85L)).thenReturn(doc);
        when(changeDocMapper.selectForUpdate("default", 85L)).thenReturn(doc);
        when(changeDocFieldMapper.findByTemplate(101L)).thenReturn(List.of(field(101L, "application_table")));
        when(changeDocFieldMapper.findByTemplate(202L)).thenReturn(List.of(field(202L, "plan_table")));

        service.approve(platformUser(), 85L, "approved", true);

        ArgumentCaptor<ChangeDocVO> documents = ArgumentCaptor.forClass(ChangeDocVO.class);
        ArgumentCaptor<Long> templateIds = ArgumentCaptor.forClass(Long.class);
        verify(exportService, times(2)).exportPdfDirect(documents.capture(), eq("default"), templateIds.capture());
        assertThat(templateIds.getAllValues()).containsExactly(101L, 202L);
        assertThat(documents.getAllValues().get(0).getApplicationFieldConfig())
                .extracting(config -> config.getFieldKey())
                .containsExactly("application_table");
        assertThat(documents.getAllValues().get(0).getPlanFieldConfig())
                .extracting(config -> config.getFieldKey())
                .containsExactly("plan_table");
    }

    @Test
    void workflowCompletionNotifiesOnlyForEffectiveTransition() {
        ChangeDoc doc = pendingDoc(83L, 19L);
        when(changeDocMapper.selectById(83L)).thenReturn(doc);

        service.handleWorkflowApproval(83L, false, 5L, null);
        service.handleWorkflowApproval(83L, false, 5L, null);

        verify(notificationService, times(1)).notify("default", 19L, "变更文档审批被拒绝",
                "《通知测试》审批被拒绝：", "change_doc_approval", "change_doc", 83L);
    }

    @Test
    void missingApplicantDoesNotCreateNotification() {
        ChangeDoc doc = pendingDoc(84L, null);
        when(changeDocMapper.selectById(84L)).thenReturn(doc);

        service.handleWorkflowApproval(84L, true, 5L, "ok");

        verify(notificationService, never()).notify(any(), any(), any(), any(), any(), any(), any());
    }

    private ChangeDoc pendingDoc(Long id, Long applicantId) {
        ChangeDoc doc = new ChangeDoc();
        doc.setId(id);
        doc.setTenantId("default");
        doc.setTitle("通知测试");
        doc.setStatus("pending");
        doc.setApplicantId(applicantId);
        return doc;
    }

    private ChangeDocField field(Long templateId, String fieldKey) {
        ChangeDocField field = new ChangeDocField();
        field.setTemplateId(templateId);
        field.setFieldKey(fieldKey);
        field.setFieldType("fixedDocxTable");
        return field;
    }

    private SecurityUser platformUser() {
        return new SecurityUser(5L, "approver", "", "default", null, "platform", Set.of());
    }
}
