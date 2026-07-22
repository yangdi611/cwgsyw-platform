package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.ResultSetExtractor;

import java.sql.ResultSet;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthorizationResourceMigrationOwnerGroupTest {
    @Mock JdbcTemplate jdbcTemplate;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;
    @Mock ResultSet childResultSet;
    @Mock ResultSet parentResultSet;

    @Test
    void childWithoutCreatorGroupInheritsParentOwnerGroup() throws Exception {
        AuthorizationResourceMigrationService service = serviceWithParent(4L, 0670);

        service.initializeCreatedResource("default", "wiki_page", 8L, 7L, null, 0670);

        verifyInitialization(7L, 4L);
    }

    @Test
    void childWithCreatorGroupKeepsExplicitGroupWhenParentIsNotSetgid() throws Exception {
        AuthorizationResourceMigrationService service = serviceWithParent(4L, 0670);

        service.initializeCreatedResource("default", "wiki_page", 8L, 7L, 5L, 0670);

        verifyInitialization(7L, 5L);
    }

    @Test
    void childWithCreatorGroupUsesParentGroupWhenParentIsSetgid() throws Exception {
        AuthorizationResourceMigrationService service = serviceWithParent(4L, 02770);

        service.initializeCreatedResource("default", "wiki_page", 8L, 7L, 5L, 0670);

        verifyInitialization(7L, 4L);
    }

    private AuthorizationResourceMigrationService serviceWithParent(Long ownerGroupId, int permissionMode)
            throws Exception {
        when(childResultSet.next()).thenReturn(true);
        when(childResultSet.getObject("parent_id")).thenReturn(44L);
        when(parentResultSet.next()).thenReturn(true);
        when(parentResultSet.getObject("owner_group_id")).thenReturn(ownerGroupId);
        when(parentResultSet.getObject("permission_mode")).thenReturn(permissionMode);
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(8L), eq("default")))
            .thenAnswer(invocation -> invocation.<ResultSetExtractor<?>>getArgument(1).extractData(childResultSet));
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class), eq(44L), eq("default")))
            .thenAnswer(invocation -> invocation.<ResultSetExtractor<?>>getArgument(1).extractData(parentResultSet));
        when(jdbcTemplate.queryForList(anyString(), eq(Long.class), eq("default"), eq("wiki_page"), eq(44L)))
            .thenReturn(List.of());
        return new AuthorizationResourceMigrationService(jdbcTemplate, activeGroupReferenceValidator);
    }

    private void verifyInitialization(Long ownerUserId, Long ownerGroupId) {
        InOrder order = inOrder(activeGroupReferenceValidator, jdbcTemplate);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", ownerGroupId);
        order.verify(jdbcTemplate).update(anyString(), eq(ownerUserId), eq(ownerGroupId), eq(0670),
            eq(8L), eq("default"));
        verify(jdbcTemplate).update(anyString(), eq("wiki_page"), eq(8L), eq(ownerUserId),
            eq("default"), eq("wiki_page"), eq(44L));
    }
}
