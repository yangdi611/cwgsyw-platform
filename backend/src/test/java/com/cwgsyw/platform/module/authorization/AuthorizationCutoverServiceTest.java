package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.config.AuthorizationProperties;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationPermissionDiffVO;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupMembershipService;
import com.cwgsyw.platform.module.org.entity.Group;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthorizationCutoverServiceTest {
    @Mock JdbcTemplate jdbcTemplate;
    @Mock AuthorizationProperties properties;
    @Mock AuthorizationModeService modeService;
    @Mock GroupMembershipService groupMembershipService;
    @Mock AuthorizationWriteLockService authorizationWriteLockService;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;

    @Test
    void permissionDiffDetailsGroupsSourcesByAccountAndPermission() {
        AuthorizationCutoverService service = new AuthorizationCutoverService(
            jdbcTemplate, properties, modeService, groupMembershipService, authorizationWriteLockService,
            activeGroupReferenceValidator);
        when(jdbcTemplate.queryForList(anyString(), eq("default"), eq("default"))).thenReturn(List.of(
                row(2L, "kangtingting", "康婷婷", "wiki:read", "Wiki 读取",
                    false, true, "assignment", 7L, "wiki_readonly_tester",
                    "Wiki 只读测试员", 1L, "tenant", null, "当前租户", "manual"),
                row(2L, "kangtingting", "康婷婷", "wiki:read", "Wiki 读取",
                    false, true, "assignment", 8L, "wiki_auditor",
                    "Wiki 审计员", 2L, "group", 3L, "研发组", "manual"),
                row(7L, "member_manage", "管理组组员", "shared_file:read", "共享文档读取",
                    true, false, "legacy", 4L, "document_admin",
                    "文档管理员", null, null, null, null, null)));

        List<AuthorizationPermissionDiffVO> details = service.permissionDiffDetails("default");

        assertThat(details).hasSize(2);
        assertThat(details.getFirst().getUsername()).isEqualTo("kangtingting");
        assertThat(details.getFirst().isLegacyAllowed()).isFalse();
        assertThat(details.getFirst().isAssignmentAllowed()).isTrue();
        assertThat(details.getFirst().getLegacySources()).isEmpty();
        assertThat(details.getFirst().getAssignmentSources()).extracting("assignmentId")
            .containsExactly(1L, 2L);
        assertThat(details.get(1).getLegacySources()).extracting("roleCode")
            .containsExactly("document_admin");
        assertThat(details.get(1).getAssignmentSources()).isEmpty();
    }

    @Test
    void activeResourceDecisionDiffSqlExcludesDeletedAndMissingResources() {
        AuthorizationCutoverService service = new AuthorizationCutoverService(
            jdbcTemplate, properties, modeService, groupMembershipService, authorizationWriteLockService,
            activeGroupReferenceValidator);

        assertThat(service.activeResourceDecisionDiffSql())
            .contains("diff.resource_type = 'wiki_space'")
            .contains("diff.resource_type = 'wiki_page'")
            .contains("diff.resource_type = 'shared_folder'")
            .contains("diff.resource_type = 'shared_file'")
            .contains("resource.tenant_id = diff.tenant_id")
            .contains("NOT resource.is_deleted")
            .contains("space.write_scope <> 'all'");
    }

    @Test
    void assignPrimaryGroupLocksAllAffectedGroupsInStableOrder() throws Exception {
        AuthorizationCutoverService service = new AuthorizationCutoverService(
            jdbcTemplate, properties, modeService, groupMembershipService, authorizationWriteLockService,
            activeGroupReferenceValidator);
        when(jdbcTemplate.queryForList(anyString(), eq(Long.class), eq("default"), eq(7L),
            eq("default"), eq(7L))).thenReturn(List.of(9L, 3L, 9L));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(7L), eq("default")))
            .thenReturn(0L);
        Group group = new Group();
        group.setGroupType("business");
        when(activeGroupReferenceValidator.lockAndRequire("default", 5L)).thenReturn(group);

        service.assignPrimaryGroup("default", 7L, 5L, 1L, "platform");

        var order = inOrder(authorizationWriteLockService);
        order.verify(authorizationWriteLockService).lockUserAuthorization("default", 7L);
        order.verify(authorizationWriteLockService).lockRoleAuthorization("default", 3L);
        order.verify(authorizationWriteLockService).lockRoleAuthorization("default", 9L);
        order.verify(authorizationWriteLockService).lockGroupAssignment("default", 7L, 3L);
        order.verify(authorizationWriteLockService).lockGroupAssignment("default", 7L, 5L);
        order.verify(authorizationWriteLockService).lockGroupAssignment("default", 7L, 9L);
        verify(groupMembershipService).setPrimaryMembership(7L, 5L, "default", 1L);
        verify(activeGroupReferenceValidator).lockAndRequire("default", 5L);
    }

    @Test
    void duplicateEnforceRejectsBeforeChangingAuthorizationState() {
        AuthorizationCutoverService service = new AuthorizationCutoverService(
            jdbcTemplate, properties, modeService, groupMembershipService, authorizationWriteLockService,
            activeGroupReferenceValidator);
        when(properties.getDecisionMode()).thenReturn(AuthorizationProperties.DecisionMode.ENFORCED);
        when(jdbcTemplate.query(anyString(), org.mockito.ArgumentMatchers.<org.springframework.jdbc.core.ResultSetExtractor<String>>any(), eq("default")))
            .thenReturn("enforced");

        org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> service.enforce("default", 1L, "platform", "ENFORCE"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("当前已处于 Enforced 状态，无需重复切换");

        verifyNoInteractions(authorizationWriteLockService);
        verify(jdbcTemplate, never()).update(anyString(), org.mockito.ArgumentMatchers.<Object[]>any());
    }

    @Test
    void duplicateRollbackRejectsBeforeChangingAuthorizationState() {
        AuthorizationCutoverService service = new AuthorizationCutoverService(
            jdbcTemplate, properties, modeService, groupMembershipService, authorizationWriteLockService,
            activeGroupReferenceValidator);
        when(jdbcTemplate.query(anyString(), org.mockito.ArgumentMatchers.<org.springframework.jdbc.core.ResultSetExtractor<String>>any(), eq("default")))
            .thenReturn("rollback");

        assertThatThrownBy(() -> service.rollback("default", 1L, "platform", "ROLLBACK"))
            .isInstanceOf(IllegalStateException.class)
            .hasMessage("当前已处于 Rollback 状态，无需重复回退");

        verify(jdbcTemplate, never()).update(anyString(), org.mockito.ArgumentMatchers.<Object[]>any());
    }

    private Map<String, Object> row(Long userId, String username, String realName,
                                    String permissionCode, String permissionName,
                                    boolean legacyAllowed, boolean assignmentAllowed,
                                    String sourceModel, Long roleId, String roleCode,
                                    String roleName, Long assignmentId, String scopeType,
                                    Long scopeId, String scopeName, String originType) {
        Map<String, Object> row = new HashMap<>();
        row.put("user_id", userId);
        row.put("username", username);
        row.put("real_name", realName);
        row.put("permission_code", permissionCode);
        row.put("permission_name", permissionName);
        row.put("legacy_allowed", legacyAllowed);
        row.put("assignment_allowed", assignmentAllowed);
        row.put("source_model", sourceModel);
        row.put("role_id", roleId);
        row.put("role_code", roleCode);
        row.put("role_name", roleName);
        row.put("assignment_id", assignmentId);
        row.put("scope_type", scopeType);
        row.put("scope_id", scopeId);
        row.put("scope_name", scopeName);
        row.put("origin_type", originType);
        return row;
    }
}
