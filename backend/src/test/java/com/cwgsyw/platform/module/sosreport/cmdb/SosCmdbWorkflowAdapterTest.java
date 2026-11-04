package com.cwgsyw.platform.module.sosreport.cmdb;

import com.cwgsyw.platform.module.sosreport.SosTestSupport;
import com.cwgsyw.platform.module.sosreport.entity.SosCmdbRequest;
import com.cwgsyw.platform.module.sosreport.mapper.SosCmdbRequestMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.workflow.adapter.BusinessWorkflowSummary;
import com.cwgsyw.platform.module.workflow.adapter.SosCmdbWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.template.BuiltinTemplates;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SosCmdbWorkflowAdapterTest {

    @Mock SosCmdbRequestMapper requestMapper;
    @Mock SosCmdbApplyService applyService;
    @Mock UserMapper userMapper;

    private SosCmdbWorkflowAdapter adapter;
    private SosCmdbRequest request;

    @BeforeEach
    void setUp() {
        SosTestSupport.initTables();
        adapter = new SosCmdbWorkflowAdapter(requestMapper, applyService, userMapper);
        request = new SosCmdbRequest();
        request.setId(9L);
        request.setTenantId("tenant-a");
        request.setReportId(5L);
        request.setAction(SosCmdbRequest.ACTION_CREATE);
        request.setInstanceName("web-01");
        when(requestMapper.selectOne(any())).thenReturn(request);
    }

    @Test
    void approverNeedsApprovePermissionAndCmdbWriteForTheAction() {
        assertTrue(adapter.canApprove("tenant-a", "9",
            SosTestSupport.user("tenant-a", 1L, "sos_report:approve", "cmdb_instance:create")));
        assertFalse(adapter.canApprove("tenant-a", "9",
            SosTestSupport.user("tenant-a", 1L, "sos_report:approve")), "没有 CMDB 写权限不能审批");
        assertFalse(adapter.canApprove("tenant-a", "9",
            SosTestSupport.user("tenant-a", 1L, "cmdb_instance:create")), "没有审批权限不能审批");
        assertFalse(adapter.canApprove("tenant-a", "9",
            SosTestSupport.user("tenant-a", 1L, "sos_report:approve", "cmdb_instance:update")), "新增需要 create 权限");
        assertFalse(adapter.canApprove("tenant-a", "9", null));
    }

    @Test
    void updateRequiresUpdatePermission() {
        request.setAction(SosCmdbRequest.ACTION_UPDATE);

        assertTrue(adapter.canApprove("tenant-a", "9",
            SosTestSupport.user("tenant-a", 1L, "sos_report:approve", "cmdb_instance:update")));
        assertFalse(adapter.canApprove("tenant-a", "9",
            SosTestSupport.user("tenant-a", 1L, "sos_report:approve", "cmdb_instance:create")));
    }

    @Test
    void submitterNeedsSubmitPermission() {
        assertTrue(adapter.canSubmit("tenant-a", "9", SosTestSupport.user("tenant-a", 1L, "sos_report:submit")));
        assertFalse(adapter.canSubmit("tenant-a", "9", SosTestSupport.user("tenant-a", 1L, "sos_report:read")));
    }

    @Test
    void otherTenantOrUnknownRequestIsNotApprovableOrVisible() {
        when(requestMapper.selectOne(any())).thenReturn(null);

        assertFalse(adapter.canApprove("tenant-b", "9",
            SosTestSupport.user("tenant-b", 1L, "sos_report:approve", "cmdb_instance:create")));
        assertFalse(adapter.buildSummary("tenant-b", "9", null).isAvailable());
        assertFalse(adapter.canSubmit("tenant-b", "abc", SosTestSupport.user("tenant-b", 1L, "sos_report:submit")));
    }

    @Test
    void summaryLinksBackToReport() {
        BusinessWorkflowSummary summary = adapter.buildSummary("tenant-a", "9", null);

        assertTrue(summary.isAvailable());
        assertEquals("sos_cmdb_request", summary.getBusinessType());
        assertEquals("/sos-reports/5", summary.getBusinessUrl());
        assertTrue(summary.getBusinessTitle().contains("web-01"));
    }

    @Test
    void businessTypeIsSelectableInTemplates() {
        assertEquals("sos_cmdb_request:9", adapter.buildBusinessKey("9"));
        assertTrue(BuiltinTemplates.all().stream()
            .anyMatch(template -> template.getSupportedBusinessTypes().contains(SosCmdbWorkflowAdapter.BUSINESS_TYPE)));
    }
}
