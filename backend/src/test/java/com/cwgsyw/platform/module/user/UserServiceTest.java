package com.cwgsyw.platform.module.user;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.dto.CreateUserRequest;
import com.cwgsyw.platform.module.user.dto.UpdateUserRequest;
import com.cwgsyw.platform.module.user.dto.UserDetailVO;
import com.cwgsyw.platform.module.user.dto.UserListVO;
import com.cwgsyw.platform.module.user.entity.User;
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
        verify(userMapper).updateById((User) argThat(u -> {
            assertTrue(((User) u).getIsDeleted());
            assertEquals(3L, ((User) u).getDeletedBy());
            assertNotNull(((User) u).getDeletedAt());
            return true;
        }));
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

        Group group = new Group();
        group.setId(1L);
        group.setName("运维组");
        when(groupMapper.selectBatchIds(java.util.Set.of(1L))).thenReturn(List.of(group));

        // When
        PageResult<UserListVO> result = userService.list(1, 20, "default", "张三");

        // Then
        assertNotNull(result);
        assertEquals(1, result.getTotal());
        assertEquals("运维组", result.getRecords().get(0).getGroupName());
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

        Group group = new Group();
        group.setId(1L);
        group.setName("运维组");
        when(groupMapper.selectBatchIds(java.util.Set.of(1L))).thenReturn(List.of(group));

        // When
        PageResult<UserListVO> result = userService.list(1, 20, "default", null);

        // Then
        assertNotNull(result);
        assertEquals(1, result.getTotal());
        assertEquals("运维组", result.getRecords().get(0).getGroupName());
        verify(userMapper).selectPage(any(Page.class), any(LambdaQueryWrapper.class));
    }

    @Test
    void list_withGroupId_returnsGroupName() {
        // Given
        Page<User> pageResult = new Page<>(1, 20);
        pageResult.setRecords(List.of(createUser(1L, "zhangsan", "13800138000", 5L)));
        pageResult.setTotal(1);

        when(userMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
            .thenReturn(pageResult);

        Group group = new Group();
        group.setId(5L);
        group.setName("网络组");
        when(groupMapper.selectBatchIds(java.util.Set.of(5L))).thenReturn(List.of(group));

        // When
        PageResult<UserListVO> result = userService.list(1, 20, "default", null);

        // Then
        assertNotNull(result);
        assertEquals(1, result.getRecords().size());
        UserListVO vo = result.getRecords().get(0);
        assertEquals(5L, vo.getGroupId());
        assertEquals("网络组", vo.getGroupName());
        assertEquals("zhangsan", vo.getUsername());
    }

    @Test
    void list_someUsersWithoutGroupId_groupNameIsNull() {
        // Given
        User userWithGroup = createUser(1L, "zhangsan", "13800138000", 1L);
        User userNoGroup = createUser(2L, "lisi", "13900139000", null);

        Page<User> pageResult = new Page<>(1, 20);
        pageResult.setRecords(List.of(userWithGroup, userNoGroup));
        pageResult.setTotal(2);

        when(userMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
            .thenReturn(pageResult);

        Group group = new Group();
        group.setId(1L);
        group.setName("运维组");
        when(groupMapper.selectBatchIds(java.util.Set.of(1L))).thenReturn(List.of(group));

        // When
        PageResult<UserListVO> result = userService.list(1, 20, "default", null);

        // Then
        assertEquals(2, result.getRecords().size());
        UserListVO voWithGroup = result.getRecords().get(0);
        UserListVO voNoGroup = result.getRecords().get(1);
        assertEquals("运维组", voWithGroup.getGroupName());
        assertNull(voNoGroup.getGroupId());
        assertNull(voNoGroup.getGroupName());
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
}
