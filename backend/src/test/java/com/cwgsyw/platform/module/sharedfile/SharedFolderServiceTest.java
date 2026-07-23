package com.cwgsyw.platform.module.sharedfile;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.authorization.ResourceAuthorizationInitializer;
import com.cwgsyw.platform.module.authorization.AuthorizationService;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFolder;
import com.cwgsyw.platform.module.user.UserMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SharedFolderServiceTest {
    @Mock SharedFolderMapper folderMapper;
    @Mock SharedFileMapper fileMapper;
    @Mock AuditLogMapper auditLogMapper;
    @Mock ResourceAuthorizationInitializer resourceAuthorizationInitializer;
    @Mock UserMapper userMapper;
    @Mock AuthorizationService authorizationService;
    @InjectMocks SharedFolderService service;

    @Test
    void createFolder_rejectsBlankAndPathLikeNamesBeforeDatabaseWrite() {
        assertThatThrownBy(() -> service.createFolder("default", 1L, " ", null, 1L))
            .isInstanceOf(BusinessException.class).hasMessage("文件夹名称不能为空");
        assertThatThrownBy(() -> service.createFolder("default", 1L, "a/b", null, 1L))
            .isInstanceOf(BusinessException.class).hasMessage("文件夹名称格式不合法");
        verify(folderMapper, never()).insert(any(SharedFolder.class));
    }

    @Test
    void updateFolder_movesAndRenamesWhilePreservingAclState() {
        SharedFolder folder = folder(8L, "old", "old", 2L);
        folder.setAclInherited(true);
        when(folderMapper.selectById(8L)).thenReturn(folder);
        when(folderMapper.selectById(3L)).thenReturn(folder(3L, "target", "target", null));
        when(folderMapper.selectCount(any())).thenReturn(0L);

        service.updateFolder("default", 7L, 8L, " Renamed ", 3L, true);

        assertThat(folder.getName()).isEqualTo("Renamed");
        assertThat(folder.getNormalizedName()).isEqualTo("renamed");
        assertThat(folder.getParentId()).isEqualTo(3L);
        assertThat(folder.getAclInherited()).isTrue();
        verify(folderMapper).lockFolderTree("default");
        verify(folderMapper).updateById(any(SharedFolder.class));
        verify(auditLogMapper).insert(any(AuditLog.class));
    }

    @Test
    void updateFolder_rejectsMovingIntoDescendantWithoutMutation() {
        SharedFolder source = folder(8L, "source", "source", null);
        SharedFolder descendant = folder(9L, "child", "child", 8L);
        when(folderMapper.selectById(8L)).thenReturn(source);
        when(folderMapper.selectById(9L)).thenReturn(descendant);

        assertThatThrownBy(() -> service.updateFolder("default", 7L, 8L, null, 9L, true))
            .isInstanceOf(BusinessException.class).hasMessage("不能移动到子文件夹");
        verify(folderMapper, never()).updateById(any(SharedFolder.class));
    }

    @Test
    void updateFolder_rejectsNormalizedSiblingConflictWithoutMutation() {
        SharedFolder source = folder(8L, "source", "source", null);
        when(folderMapper.selectById(8L)).thenReturn(source);
        when(folderMapper.selectCount(any())).thenReturn(1L);

        assertThatThrownBy(() -> service.updateFolder("default", 7L, 8L, "SOURCE", null, false))
            .isInstanceOf(BusinessException.class).hasMessage("当前目录已存在同名文件夹");
        verify(folderMapper, never()).updateById(any(SharedFolder.class));
    }

    private SharedFolder folder(Long id, String name, String normalizedName, Long parentId) {
        SharedFolder folder = new SharedFolder();
        folder.setId(id);
        folder.setTenantId("default");
        folder.setName(name);
        folder.setNormalizedName(normalizedName);
        folder.setParentId(parentId);
        return folder;
    }
}
