package com.cwgsyw.platform.module.sharedfile;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.sharedfile.dto.SharedFolderVO;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFolder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import com.cwgsyw.platform.module.authorization.AuthorizationResourceMigrationService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.authorization.AuthorizationService;
import com.cwgsyw.platform.security.SecurityUser;

@Service
@RequiredArgsConstructor
public class SharedFolderService {

    private final SharedFolderMapper folderMapper;
    private final SharedFileMapper fileMapper;
    private final AuditLogMapper auditLogMapper;
    private final AuthorizationResourceMigrationService resourceMigrationService;
    private final UserMapper userMapper;
    private final AuthorizationService authorizationService;

    public List<SharedFolderVO> getFolderTree(String tenantId) {
        List<SharedFolder> all = folderMapper.findAllByTenant(tenantId);
        Map<Long, SharedFolderVO> voMap = new LinkedHashMap<>();
        for (SharedFolder f : all) {
            SharedFolderVO vo = toVO(f);
            voMap.put(f.getId(), vo);
        }
        List<SharedFolderVO> roots = new ArrayList<>();
        for (SharedFolderVO vo : voMap.values()) {
            if (vo.getParentId() == null) {
                roots.add(vo);
            } else {
                SharedFolderVO parent = voMap.get(vo.getParentId());
                if (parent != null) parent.getChildren().add(vo);
                else roots.add(vo);
            }
        }
        return roots;
    }

    public List<SharedFolderVO> getFolderTree(SecurityUser user) {
        List<SharedFolderVO> tree = getFolderTree(user.getTenantId());
        List<SharedFolderVO> visible = authorizationService.isEnforced(user, "shared_file")
            ? filterReadable(tree, user) : tree;
        applyCapabilities(visible, user);
        return visible;
    }

    @Transactional
    public SharedFolderVO createFolder(String tenantId, Long operatorId, String name, Long parentId,
                                       Long ownerGroupId) {
        SharedFolder folder = new SharedFolder();
        folder.setTenantId(tenantId);
        folder.setName(name);
        folder.setParentId(parentId);
        folder.setAclInherited(true);
        folder.setCreatedBy(operatorId);
        folder.setCreatedAt(LocalDateTime.now());
        folder.setUpdatedAt(LocalDateTime.now());
        folderMapper.insert(folder);
        resourceMigrationService.initializeCreatedResource(tenantId, "shared_folder", folder.getId(),
            operatorId, ownerGroupId, 02770);

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("shared_file").action("create_folder")
                .targetId(folder.getId()).targetType("shared_folder")
                .operatorId(operatorId).remark("name=" + name)
                .createdAt(LocalDateTime.now()).build());

        return toVO(folder);
    }

    @Transactional
    public void deleteFolder(String tenantId, Long folderId, Long operatorId) {
        SharedFolder folder = folderMapper.selectById(folderId);
        if (folder == null || !tenantId.equals(folder.getTenantId())) {
            throw new IllegalArgumentException("文件夹不存在: " + folderId);
        }

        // 非空校验：有文件或子文件夹时拒绝删除
        long fileCount = fileMapper.selectCount(new LambdaQueryWrapper<SharedFile>()
                .eq(SharedFile::getTenantId, tenantId)
                .eq(SharedFile::getFolderId, folderId));
        long childCount = folderMapper.selectCount(new LambdaQueryWrapper<SharedFolder>()
                .eq(SharedFolder::getTenantId, tenantId)
                .eq(SharedFolder::getParentId, folderId));
        if (fileCount > 0 || childCount > 0) {
            throw new IllegalStateException("文件夹非空，请先删除内部文件和子文件夹后再删除");
        }

        folderMapper.deleteById(folderId);

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("shared_file").action("delete_folder")
                .targetId(folderId).targetType("shared_folder")
                .operatorId(operatorId).remark("name=" + folder.getName())
                .createdAt(LocalDateTime.now()).build());
    }

    public SharedFolder getOrCreateFolder(String tenantId, Long operatorId, String path) {
        String[] parts = path.split("/");
        Long parentId = null;
        SharedFolder current = null;
        for (String part : parts) {
            if (part.isBlank()) continue;
            LambdaQueryWrapper<SharedFolder> qw = new LambdaQueryWrapper<SharedFolder>()
                    .eq(SharedFolder::getTenantId, tenantId)
                    .eq(SharedFolder::getName, part);
            if (parentId != null) qw.eq(SharedFolder::getParentId, parentId);
            else qw.isNull(SharedFolder::getParentId);
            SharedFolder existing = folderMapper.selectOne(qw);
            if (existing != null) {
                current = existing;
                parentId = existing.getId();
            } else {
                SharedFolder newFolder = new SharedFolder();
                newFolder.setTenantId(tenantId);
                newFolder.setName(part);
                newFolder.setParentId(parentId);
                newFolder.setAclInherited(true);
                newFolder.setCreatedBy(operatorId);
                newFolder.setCreatedAt(LocalDateTime.now());
                newFolder.setUpdatedAt(LocalDateTime.now());
                folderMapper.insert(newFolder);
                resourceMigrationService.initializeCreatedResource(tenantId, "shared_folder", newFolder.getId(),
                    operatorId, primaryGroupId(operatorId), 02770);
                current = newFolder;
                parentId = newFolder.getId();
            }
        }
        return current;
    }

    private SharedFolderVO toVO(SharedFolder f) {
        SharedFolderVO vo = new SharedFolderVO();
        vo.setId(f.getId());
        vo.setName(f.getName());
        vo.setParentId(f.getParentId());
        vo.setAclCustom(Boolean.FALSE.equals(f.getAclInherited()));
        vo.setChildren(new ArrayList<>());
        return vo;
    }

    private List<SharedFolderVO> filterReadable(List<SharedFolderVO> folders, SecurityUser user) {
        List<SharedFolderVO> result = new ArrayList<>();
        for (SharedFolderVO folder : folders) {
            if (!authorizationService.decide(user, "shared_file:read", "shared_folder", folder.getId(), 5)
                    .isAllowed()) continue;
            folder.setChildren(filterReadable(folder.getChildren(), user));
            result.add(folder);
        }
        return result;
    }

    private void applyCapabilities(List<SharedFolderVO> folders, SecurityUser user) {
        for (SharedFolderVO folder : folders) {
            boolean legacyManage = user.getPermissions().contains("shared_file:manage");
            boolean legacyUpload = user.getPermissions().contains("shared_file:upload");
            boolean legacyDelete = user.getPermissions().contains("shared_file:delete");
            boolean legacyManageAcl = user.getPermissions().contains("shared_file:manage_acl");
            folder.setCanCreateChild(authorizationService.decideWithCompatibility(user, "shared_file",
                "shared_file:manage", "shared_folder", folder.getId(), 3, legacyManage));
            folder.setCanUpload(authorizationService.decideWithCompatibility(user, "shared_file",
                "shared_file:upload", "shared_folder", folder.getId(), 3, legacyUpload));
            folder.setCanDelete(authorizationService.decideParentWithCompatibility(user, "shared_file",
                "shared_file:delete", "shared_folder", folder.getId(), 3, legacyDelete));
            folder.setCanManageAcl(authorizationService.decideWithCompatibility(user, "shared_file",
                "shared_file:manage_acl", "shared_folder", folder.getId(), 2, legacyManageAcl));
            applyCapabilities(folder.getChildren(), user);
        }
    }

    private Long primaryGroupId(Long userId) {
        if (userId == null) return null;
        User user = userMapper.selectById(userId);
        return user == null ? null : user.getGroupId();
    }
}
