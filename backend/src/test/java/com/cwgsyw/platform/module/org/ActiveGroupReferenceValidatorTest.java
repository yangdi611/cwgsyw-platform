package com.cwgsyw.platform.module.org;

import com.cwgsyw.platform.module.org.entity.Group;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ActiveGroupReferenceValidatorTest {
    @Mock GroupMapper groupMapper;

    private ActiveGroupReferenceValidator validator;

    @BeforeEach
    void setUp() {
        validator = new ActiveGroupReferenceValidator(groupMapper);
    }

    @Test
    void activeSameTenantBusinessGroupIsAcceptedAfterTenantBoundLock() {
        Group active = group(false, "business");
        when(groupMapper.lockByTenantAndIdIncludingDeleted("tenant-a", 11L)).thenReturn(active);

        Group result = validator.lockAndRequire("tenant-a", 11L);

        assertSame(active, result);
        InOrder order = inOrder(groupMapper);
        order.verify(groupMapper).lockByTenantAndIdIncludingDeleted("tenant-a", 11L);
    }

    @Test
    void archivedGroupReturnsStableInactiveContract() {
        Group archived = group(true, "business");
        when(groupMapper.lockByTenantAndIdIncludingDeleted("tenant-a", 11L)).thenReturn(archived);

        assertInactive(() -> validator.lockAndRequire("tenant-a", 11L));
    }

    @Test
    void missingGroupReturnsStableInactiveContract() {
        when(groupMapper.lockByTenantAndIdIncludingDeleted("tenant-a", 11L)).thenReturn(null);

        assertInactive(() -> validator.lockAndRequire("tenant-a", 11L));
    }

    @Test
    void crossTenantGroupReturnsStableInactiveContractWithoutFallbackLookup() {
        when(groupMapper.lockByTenantAndIdIncludingDeleted("tenant-a", 11L)).thenReturn(null);

        assertInactive(() -> validator.lockAndRequire("tenant-a", 11L));
        verify(groupMapper).lockByTenantAndIdIncludingDeleted("tenant-a", 11L);
    }

    @Test
    void nonBusinessGroupReturnsStableInactiveContract() {
        Group unassigned = group(false, "unassigned");
        when(groupMapper.lockByTenantAndIdIncludingDeleted("tenant-a", 11L)).thenReturn(unassigned);

        assertInactive(() -> validator.lockAndRequire("tenant-a", 11L));
    }

    @Test
    void absentOptionalReferenceIsAcceptedWithoutDatabaseRead() {
        assertNull(validator.lockAndRequire("tenant-a", null));
    }

    private void assertInactive(org.junit.jupiter.api.function.Executable operation) {
        GroupLifecycleException error = assertThrows(GroupLifecycleException.class, operation);
        assertEquals(409, error.getHttpStatus());
        assertEquals("GROUP_REFERENCE_INACTIVE", error.getErrorCode());
        assertEquals("目标用户组不存在、已归档或不可用于业务引用", error.getMessage());
    }

    private Group group(boolean deleted, String groupType) {
        Group group = new Group();
        group.setId(11L);
        group.setTenantId("tenant-a");
        group.setIsDeleted(deleted);
        group.setGroupType(groupType);
        return group;
    }
}
