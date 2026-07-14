package com.cwgsyw.platform.module.sharedfile;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.rbac.SysRoleMapper;
import com.cwgsyw.platform.module.sharedfile.dto.AclEntryDTO;
import com.cwgsyw.platform.module.sharedfile.dto.FolderAclDTO;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFolder;
import com.cwgsyw.platform.module.user.UserMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SharedFolderAclGroupReferenceTest {
    @Mock SharedFolderMapper folderMapper;
    @Mock SharedFolderAclMapper aclMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock RbacService rbacService;
    @Mock UserMapper userMapper;
    @Mock GroupMapper groupMapper;
    @Mock SysRoleMapper roleMapper;
    @Mock ObjectMapper objectMapper;
    @Mock ActiveGroupReferenceValidator activeGroupReferenceValidator;

    @InjectMocks SharedFolderAclService service;

    @Test
    void setAclValidatesGroupSubjectsInAscendingOrderBeforeFolderMutation() {
        SharedFolder folder = new SharedFolder();
        folder.setId(8L);
        folder.setTenantId("default");
        when(folderMapper.selectById(8L)).thenReturn(folder);
        FolderAclDTO dto = new FolderAclDTO();
        dto.setInherited(false);
        dto.setEntries(List.of(groupEntry(9L), groupEntry(4L)));

        service.setAcl("default", 8L, 7L, dto);

        var order = inOrder(activeGroupReferenceValidator, folderMapper);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 4L);
        order.verify(activeGroupReferenceValidator).lockAndRequire("default", 9L);
        order.verify(folderMapper).updateById(folder);
    }

    private AclEntryDTO groupEntry(Long groupId) {
        AclEntryDTO entry = new AclEntryDTO();
        entry.setSubjectType("group");
        entry.setSubjectId(groupId);
        entry.setPermissions(List.of("read"));
        return entry;
    }
}
