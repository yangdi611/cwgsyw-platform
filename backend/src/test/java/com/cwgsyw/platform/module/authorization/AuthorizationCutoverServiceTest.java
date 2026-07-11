package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.config.AuthorizationProperties;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationPermissionDiffVO;
import com.cwgsyw.platform.module.org.GroupMembershipService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthorizationCutoverServiceTest {
    @Mock JdbcTemplate jdbcTemplate;
    @Mock AuthorizationProperties properties;
    @Mock AuthorizationModeService modeService;
    @Mock GroupMembershipService groupMembershipService;

    @Test
    void permissionDiffDetailsGroupsSourcesByAccountAndPermission() {
        AuthorizationCutoverService service = new AuthorizationCutoverService(
            jdbcTemplate, properties, modeService, groupMembershipService);
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
