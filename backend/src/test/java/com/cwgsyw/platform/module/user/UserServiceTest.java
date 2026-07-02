package com.cwgsyw.platform.module.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.config.SecurityProperties;
import com.cwgsyw.platform.module.auth.session.AuthSessionService;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.dto.CreateUserRequest;
import com.cwgsyw.platform.module.user.dto.ResetPasswordRequest;
import com.cwgsyw.platform.module.user.dto.UpdateUserRequest;
import com.cwgsyw.platform.module.user.dto.UserDetailVO;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.user.password.PasswordHistoryService;
import com.cwgsyw.platform.module.user.password.PasswordHistorySource;
import com.cwgsyw.platform.module.user.password.PasswordPolicyService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserMapper userMapper;
    @Mock PasswordEncoder passwordEncoder;
    @Mock RbacService rbacService;
    @Mock GroupMapper groupMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock PasswordPolicyService passwordPolicyService;
    @Mock PasswordHistoryService passwordHistoryService;
    @Mock AuthSessionService authSessionService;
    @Mock SecurityProperties securityProperties;

    @InjectMocks UserService userService;

    private User createUser(Long id, String username, String phone, Long groupId) {
        User user = new User();
        user.setId(id);
        user.setTenantId("default");
        user.setUsername(username);
        user.setPassword("encoded-password");
        user.setRealName("张三");
        user.setEmail("zhangsan@example.com");
        user.setPhone(phone);
        user.setGroupId(groupId);
        user.setStatus(1);
        return user;
    }

    // ── create with phone + audit log ─────────────────────────────────────

    @Test
    void create_withPhone_setsPhoneAndWritesAuditLog() {
        // Given
        CreateUserRequest req = new CreateUserRequest();
        req.setUsername("newuser");
        req.setPassword("password123");
        req.setPhone("13800138000");
        req.setRealName("新用户");
        req.setEmail("new@example.com");
        req.setGroupId(1L);

        when(userMapper.findByUsername("newuser")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("encoded-password");
        when(userMapper.insert(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(100L);
            return 1;
        });

        // When
        User result = userService.create(req, "default", 1L);

        // Then
        assertNotNull(result);
        assertEquals("13800138000", result.getPhone());
        assertEquals("newuser", result.getUsername());
        // 首次登录强制改密（SPEC 11.4）
        assertTrue(result.getMustChangePassword());
        // email + phone 都非空 -> profileCompleted = true
        assertTrue(result.getProfileCompleted());

        // 密码历史写入（source = CREATE_USER）
        verify(passwordHistoryService).record(eq(100L), eq("default"), eq("encoded-password"),
            eq(PasswordHistorySource.CREATE_USER), eq(1L));

        // Verify audit log was written
        ArgumentCaptor<AuditLog> logCaptor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(logCaptor.capture());
        AuditLog auditLog = logCaptor.getValue();
        assertEquals("user", auditLog.getModule());
        assertEquals("create", auditLog.getAction());
        assertEquals(100L, auditLog.getTargetId());
        assertEquals("user", auditLog.getTargetType());
        assertEquals(1L, auditLog.getOperatorId());
        assertEquals("default", auditLog.getTenantId());
        assertNull(auditLog.getBeforeJson());
        assertNotNull(auditLog.getAfterJson());
        assertTrue(auditLog.getAfterJson().contains("\"phone\":\"13800138000\""));
        assertTrue(auditLog.getAfterJson().contains("\"password\":\"***\""));
        assertTrue(auditLog.getRemark().contains("newuser"));
    }

    @Test
    void create_withoutPhoneOrEmail_profileNotCompleted() {
        CreateUserRequest req = new CreateUserRequest();
        req.setUsername("bareuser");
        req.setPassword("password123");

        when(userMapper.findByUsername("bareuser")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("password123")).thenReturn("encoded-password");
        when(userMapper.insert(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(101L);
            return 1;
        });

        User result = userService.create(req, "default", 1L);

        assertTrue(result.getMustChangePassword());
        assertFalse(result.getProfileCompleted());
    }

    // ── update with audit log (before/after) ─────────────────────────────

    @Test
    void update_withPhone_changeWritesBeforeAndAfterAuditLog() {
        // Given
        User existing = createUser(1L, "existinguser", "13800138000", 1L);
        when(userMapper.selectById(1L)).thenReturn(existing);

        UpdateUserRequest req = new UpdateUserRequest();
        req.setPhone("13900139000");
        req.setEmail("updated@example.com");

        // When
        userService.update(1L, req, 2L);

        // Then
        ArgumentCaptor<AuditLog> logCaptor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(logCaptor.capture());
        AuditLog auditLog = logCaptor.getValue();
        assertEquals("update", auditLog.getAction());
        assertEquals(2L, auditLog.getOperatorId());

        // Check before/after JSON
        assertNotNull(auditLog.getBeforeJson());
        assertNotNull(auditLog.getAfterJson());
        assertTrue(auditLog.getBeforeJson().contains("\"phone\":\"13800138000\""));
        assertTrue(auditLog.getAfterJson().contains("\"phone\":\"13900139000\""));
        assertTrue(auditLog.getBeforeJson().contains("\"password\":\"***\""));
        assertTrue(auditLog.getAfterJson().contains("\"password\":\"***\""));

        // 未禁用，不撤销会话
        verify(authSessionService, never()).revokeAllForUser(anyLong(), any(), anyString());
    }

    @Test
    void update_disablingUser_revokesAllSessions() {
        User existing = createUser(1L, "existinguser", "13800138000", 1L);
        when(userMapper.selectById(1L)).thenReturn(existing);

        UpdateUserRequest req = new UpdateUserRequest();
        req.setStatus(0);

        userService.update(1L, req, 2L);

        verify(authSessionService).revokeAllForUser(1L, 2L, "ADMIN_DISABLE");
        // 两条审计：disable + update
        verify(auditLogMapper, times(2)).insert(any(AuditLog.class));
    }

    // ── delete with audit log ─────────────────────────────────────────────

    @Test
    void delete_writesBeforeAuditLogAndSoftDeletes() {
        // Given
        User existing = createUser(1L, "deleteuser", "13800138000", 1L);
        when(userMapper.selectById(1L)).thenReturn(existing);

        // When
        userService.delete(1L, 3L);

        // Then
        ArgumentCaptor<AuditLog> logCaptor = ArgumentCaptor.forClass(AuditLog.class);
        verify(auditLogMapper).insert(logCaptor.capture());
        AuditLog auditLog = logCaptor.getValue();
        assertEquals("delete", auditLog.getAction());
        assertEquals(3L, auditLog.getOperatorId());
        assertNotNull(auditLog.getBeforeJson());
        assertNull(auditLog.getAfterJson());
        assertTrue(auditLog.getBeforeJson().contains("\"username\":\"deleteuser\""));
        assertTrue(auditLog.getRemark().contains("deleteuser"));

        // Verify user soft-deleted
        verify(userMapper).updateById(argThat((User u) -> {
            assertTrue(u.getIsDeleted());
            assertEquals(3L, u.getDeletedBy());
            assertNotNull(u.getDeletedAt());
            return true;
        }));

        // 删除前撤销所有会话（SPEC 11.4）
        verify(authSessionService).revokeAllForUser(1L, 3L, "ADMIN_DELETE");
    }

    // ── keyword search ─────────────────────────────────────────────────────

    @Test
    void list_withKeyword_addsLikeCondition() {
        // Given
        Page<User> pageResult = new Page<>(1, 20);
        pageResult.setRecords(List.of(createUser(1L, "zhangsan", "13800138000", 1L)));
        pageResult.setTotal(1);

        when(userMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
            .thenReturn(pageResult);

        // When
        PageResult<User> result = userService.list(1, 20, "default", "张三");

        // Then
        assertNotNull(result);
        assertEquals(1, result.getTotal());
        verify(userMapper).selectPage(any(Page.class), any(LambdaQueryWrapper.class));
    }

    @Test
    void list_withoutKeyword_returnsAll() {
        // Given
        Page<User> pageResult = new Page<>(1, 20);
        pageResult.setRecords(List.of(createUser(1L, "zhangsan", "13800138000", 1L)));
        pageResult.setTotal(1);

        when(userMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
            .thenReturn(pageResult);

        // When
        PageResult<User> result = userService.list(1, 20, "default", null);

        // Then
        assertNotNull(result);
        assertEquals(1, result.getTotal());
        verify(userMapper).selectPage(any(Page.class), any(LambdaQueryWrapper.class));
    }

    // ── getDetail with groupName ─────────────────────────────────────────

    @Test
    void getDetail_withGroupId_returnsGroupName() {
        // Given
        User user = createUser(1L, "zhangsan", "13800138000", 5L);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);

        Group group = new Group();
        group.setId(5L);
        group.setName("运维组");
        when(groupMapper.selectById(5L)).thenReturn(group);

        when(rbacService.getUserRoleIds(1L)).thenReturn(List.of(10L, 20L));

        // When
        UserDetailVO vo = userService.getDetail(1L, "default");

        // Then
        assertNotNull(vo);
        assertEquals("zhangsan", vo.getUsername());
        assertEquals("13800138000", vo.getPhone());
        assertEquals(5L, vo.getGroupId());
        assertEquals("运维组", vo.getGroupName());
        assertEquals(List.of(10L, 20L), vo.getRoleIds());
    }

    @Test
    void getDetail_withoutGroupId_groupNameIsNull() {
        // Given
        User user = createUser(1L, "lisi", "13900139000", null);
        when(userMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(user);
        when(rbacService.getUserRoleIds(1L)).thenReturn(List.of());

        // When
        UserDetailVO vo = userService.getDetail(1L, "default");

        // Then
        assertNotNull(vo);
        assertEquals("lisi", vo.getUsername());
        assertEquals("13900139000", vo.getPhone());
        assertNull(vo.getGroupId());
        assertNull(vo.getGroupName());
    }

    // ── admin reset password (SPEC 11.3) ──────────────────────────────────

    @Test
    void resetPassword_success_setsMustChangePasswordAndRevokesSessions() {
        User user = createUser(1L, "zhangsan", "13800138000", 1L);
        when(userMapper.selectById(1L)).thenReturn(user);
        SecurityProperties.Password pwdCfg = new SecurityProperties.Password();
        when(securityProperties.getPassword()).thenReturn(pwdCfg);
        when(passwordEncoder.encode("ResetPwd#2026")).thenReturn("new-encoded-hash");

        ResetPasswordRequest req = new ResetPasswordRequest();
        req.setNewPassword("ResetPwd#2026");
        req.setConfirmPassword("ResetPwd#2026");

        userService.resetPassword(1L, req, 9L);

        assertEquals("new-encoded-hash", user.getPassword());
        assertTrue(user.getMustChangePassword());
        verify(passwordHistoryService).record(1L, "default", "new-encoded-hash",
            PasswordHistorySource.RESET_PASSWORD, 9L);
        verify(authSessionService).revokeAllForUser(1L, 9L, "PASSWORD_RESET");
        verify(auditLogMapper).insert(argThat((AuditLog log) ->
            "password_reset".equals(log.getAction()) && log.getOperatorId().equals(9L)));
    }

    @Test
    void revokeSessions_writesAuditLog() {
        User user = createUser(1L, "zhangsan", "13800138000", 1L);
        when(userMapper.selectById(1L)).thenReturn(user);

        userService.revokeSessions(1L, 9L);

        verify(authSessionService).revokeAllForUser(1L, 9L, "ADMIN_REVOKE");
        verify(auditLogMapper).insert(argThat((AuditLog log) ->
            "session_revoked".equals(log.getAction()) && "auth".equals(log.getModule())));
    }
}
