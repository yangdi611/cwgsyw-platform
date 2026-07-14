package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.authorization.dto.ResourceAccessRequest;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.inOrder;

@ExtendWith(MockitoExtension.class)
class ResourceAccessServiceTest {
    @Mock JdbcTemplate jdbcTemplate;
    @Mock ResourceDescriptorRepository descriptorRepository;
    @Mock AuthorizationService authorizationService;
    @Mock AuditLogMapper auditLogMapper;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;

    private ResourceAccessService service;
    private SecurityUser user;

    @BeforeEach
    void setUp() {
        service = new ResourceAccessService(jdbcTemplate, descriptorRepository,
            authorizationService, auditLogMapper, activeGroupReferenceValidator);
        user = new SecurityUser(7L, "admin", "hash", "default", 3L, "platform", Set.of());
    }

    @Test
    void staleVersionRejectsBeforeReplacingAcl() {
        when(descriptorRepository.find("default", "wiki_page", 8L)).thenReturn(resource(3L));
        stubValidOwner();
        when(jdbcTemplate.update(anyString(), eq(9L), eq(4L), eq(440), eq(8L),
            eq("default"), eq(2L))).thenReturn(0);

        assertThrows(OptimisticLockingFailureException.class,
            () -> service.replace(user, "wiki_page", 8L, request(2L)));

        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }

    @Test
    void ownerTransferReturnsUpdatedSnapshotWithoutReauthorizingNewOwner() {
        when(descriptorRepository.find("default", "wiki_page", 8L))
            .thenReturn(resource(2L), resource(3L));
        stubValidOwner();
        when(jdbcTemplate.update(anyString(), eq(9L), eq(4L), eq(440), eq(8L),
            eq("default"), eq(2L))).thenReturn(1);
        when(jdbcTemplate.update(anyString(), eq(7L), eq("default"), eq("wiki_page"), eq(8L)))
            .thenReturn(0);

        var response = service.replace(user, "wiki_page", 8L, request(2L));

        assertEquals(9L, response.getOwnerUserId());
        assertEquals(3L, response.getVersion());
        assertEquals("0670", response.getMode());
    }

    @Test
    void rejectsDefaultAclOnOrdinaryFile() {
        when(descriptorRepository.find("default", "shared_file", 8L)).thenReturn(resource(2L));
        ResourceAccessRequest request = request(2L);
        request.setDefaultEntries(List.of(entry("group", 4L, "r-x")));

        assertThrows(IllegalArgumentException.class,
            () -> service.replace(user, "shared_file", 8L, request));
    }

    @Test
    void rejectsDuplicateAccessSubjects() {
        when(descriptorRepository.find("default", "wiki_page", 8L)).thenReturn(resource(2L));
        stubValidOwner();
        ResourceAccessRequest request = request(2L);
        request.setEntries(List.of(entry("group", 4L, "r--"), entry("group", 4L, "rw-")));
        when(jdbcTemplate.update(anyString(), eq(9L), eq(4L), eq(440), eq(8L),
            eq("default"), eq(2L))).thenReturn(1);
        when(jdbcTemplate.update(anyString(), eq(7L), eq("default"), eq("wiki_page"), eq(8L)))
            .thenReturn(0);

        assertThrows(IllegalArgumentException.class,
            () -> service.replace(user, "wiki_page", 8L, request));
    }

    @Test
    void ownerAndGroupAclSubjectsAreLockedInAscendingOrderBeforeResourceMutation() {
        when(descriptorRepository.find("default", "wiki_page", 8L)).thenReturn(resource(2L));
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(9L), eq("default")))
            .thenReturn(1L);
        ResourceAccessRequest request = request(2L);
        request.setOwnerGroupId(5L);
        request.setEntries(List.of(entry("group", 7L, "r--"), entry("group", 3L, "rw-")));
        when(jdbcTemplate.update(anyString(), eq(9L), eq(5L), eq(440), eq(8L),
            eq("default"), eq(2L))).thenReturn(1);

        service.replace(user, "wiki_page", 8L, request);

        var order = inOrder(activeGroupReferenceValidator, jdbcTemplate);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 3L);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 5L);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 7L);
        order.verify(jdbcTemplate).update(anyString(), eq(9L), eq(5L), eq(440), eq(8L),
            eq("default"), eq(2L));
    }

    private void stubValidOwner() {
        when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(9L), eq("default")))
            .thenReturn(1L);
    }

    private ResourceAccessRequest request(Long version) {
        ResourceAccessRequest request = new ResourceAccessRequest();
        request.setOwnerUserId(9L);
        request.setOwnerGroupId(4L);
        request.setVersion(version);
        request.setMode("0670");
        request.setEntries(List.of());
        request.setDefaultEntries(List.of());
        return request;
    }

    private ResourceAccessRequest.ResourceAclEntryRequest entry(String type, Long id, String permissions) {
        ResourceAccessRequest.ResourceAclEntryRequest entry =
            new ResourceAccessRequest.ResourceAclEntryRequest();
        entry.setSubjectType(type);
        entry.setSubjectId(id);
        entry.setPermissions(permissions);
        return entry;
    }

    private ResourceDescriptor resource(Long version) {
        return ResourceDescriptor.builder().tenantId("default").resourceType("wiki_page")
            .resourceId(8L).ownerUserId(7L).ownerGroupId(3L).permissionMode(0670)
            .accessVersion(version).build();
    }
}
