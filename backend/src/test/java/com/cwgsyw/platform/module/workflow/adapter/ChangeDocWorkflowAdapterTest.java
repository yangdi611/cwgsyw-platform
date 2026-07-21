package com.cwgsyw.platform.module.workflow.adapter;

import com.cwgsyw.platform.module.changedoc.ChangeDocService;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDoc;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChangeDocWorkflowAdapterTest {
    @Mock ChangeDocService changeDocService;
    @Mock UserMapper userMapper;
    @InjectMocks ChangeDocWorkflowAdapter adapter;

    @Test
    void summaryDoesNotExposeBusinessToViewerWithoutReadPermission() {
        var summary = adapter.buildSummary("default", "41",
            user(Set.of("workflow:read", "change_doc:approve")));

        assertThat(summary.isAvailable()).isFalse();
        assertThat(summary.getBusinessTitle()).isNull();
        assertThat(summary.getBusinessUrl()).isNull();
        verify(changeDocService, never()).getForWorkflow("default", 41L);
    }

    @Test
    void readableSummaryContainsExactChangeDocumentUrl() {
        ChangeDoc doc = new ChangeDoc();
        doc.setId(41L);
        doc.setTenantId("default");
        doc.setChangeNo("CHG-41");
        doc.setTitle("Change 41");
        when(changeDocService.getForWorkflow("default", 41L)).thenReturn(doc);

        var summary = adapter.buildSummary("default", "41",
            user(Set.of("workflow:read", "change_doc:read")));

        assertThat(summary.isAvailable()).isTrue();
        assertThat(summary.getBusinessTitle()).isEqualTo("CHG-41");
        assertThat(summary.getBusinessUrl()).isEqualTo("/change-docs/41");
    }

    @Test
    void approvalRequiresPermissionAndTenantVisibleBusinessObject() {
        SecurityUser approver = user(Set.of("workflow:read", "change_doc:approve"));
        when(changeDocService.getForWorkflow("default", 41L)).thenReturn(new ChangeDoc());

        assertThat(adapter.canApprove("default", "41", approver)).isTrue();
        assertThat(adapter.canApprove("other-tenant", "41", approver)).isFalse();
        assertThat(adapter.canApprove("default", "41", user(Set.of("workflow:read")))).isFalse();
    }

    private SecurityUser user(Set<String> permissions) {
        return new SecurityUser(7L, "viewer", "", "default", 1L, "group", permissions);
    }
}
