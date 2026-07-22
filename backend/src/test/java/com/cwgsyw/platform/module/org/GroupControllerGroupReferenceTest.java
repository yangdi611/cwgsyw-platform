package com.cwgsyw.platform.module.org;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.org.dto.GroupRequest;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.assertThrows;

@ExtendWith(MockitoExtension.class)
class GroupControllerGroupReferenceTest {
    @Mock GroupMapper groupMapper;
    @Mock UserMapper userMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock GroupMembershipService groupMembershipService;
    @Mock GroupLifecycleService groupLifecycleService;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;

    @Test
    void updateValidatesActiveGroupBeforeMutation() {
        Group active = new Group();
        active.setId(11L);
        active.setTenantId("default");
        active.setCode("group_11");
        active.setGroupType("business");
        active.setIsBuiltin(false);
        when(activeGroupReferenceValidator.lockAndRequire("default", 11L)).thenReturn(active);
        GroupController controller = new GroupController(groupMapper, userMapper, auditLogMapper,
            groupMembershipService, groupLifecycleService, activeGroupReferenceValidator);
        GroupRequest request = new GroupRequest();
        request.setName("updated group");
        SecurityUser user = new SecurityUser(7L, "operator", "", "default", null,
            "tenant", Set.of("group:update"));

        controller.update(11L, request, user);

        InOrder order = inOrder(activeGroupReferenceValidator, groupMapper);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 11L);
        order.verify(groupMapper).updateById(any(Group.class));
    }

    @Test
    void createRejectsTrimmedActiveNameConflictBeforeInsert() {
        when(groupMapper.countActiveNameConflict("default", "duplicate", null)).thenReturn(1L);
        GroupController controller = controller();
        GroupRequest request = request("  duplicate  ");

        assertThrows(IllegalArgumentException.class, () -> controller.create(request, user("group:create")));

        verify(groupMapper, never()).insert(any(Group.class));
    }

    @Test
    void updateRejectsOtherActiveNameBeforeMutation() {
        Group active = activeGroup(11L, "original");
        when(activeGroupReferenceValidator.lockAndRequire("default", 11L)).thenReturn(active);
        when(groupMapper.countActiveNameConflict("default", "duplicate", 11L)).thenReturn(1L);
        GroupController controller = controller();

        assertThrows(IllegalArgumentException.class,
            () -> controller.update(11L, request(" duplicate "), user("group:update")));

        verify(groupMapper, never()).updateById(any(Group.class));
        org.junit.jupiter.api.Assertions.assertEquals("original", active.getName());
    }

    private GroupController controller() {
        return new GroupController(groupMapper, userMapper, auditLogMapper,
            groupMembershipService, groupLifecycleService, activeGroupReferenceValidator);
    }

    private GroupRequest request(String name) {
        GroupRequest request = new GroupRequest();
        request.setName(name);
        return request;
    }

    private SecurityUser user(String permission) {
        return new SecurityUser(7L, "operator", "", "default", null,
            "tenant", Set.of(permission));
    }

    private Group activeGroup(Long id, String name) {
        Group group = new Group();
        group.setId(id);
        group.setTenantId("default");
        group.setName(name);
        group.setCode("group_" + id);
        group.setGroupType("business");
        group.setIsBuiltin(false);
        return group;
    }
}
