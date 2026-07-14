package com.cwgsyw.platform.module.org;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.org.entity.Group;
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
import static org.mockito.Mockito.when;

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
        Group request = new Group();
        request.setName("updated group");
        SecurityUser user = new SecurityUser(7L, "operator", "", "default", null,
            "tenant", Set.of("group:update"));

        controller.update(11L, request, user);

        InOrder order = inOrder(activeGroupReferenceValidator, groupMapper);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 11L);
        order.verify(groupMapper).updateById(any(Group.class));
    }
}
