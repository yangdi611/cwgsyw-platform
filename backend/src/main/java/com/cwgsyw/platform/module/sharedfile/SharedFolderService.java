package com.cwgsyw.platform.module.sharedfile;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.sharedfile.dto.SharedFolderVO;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFile;
import com.cwgsyw.platform.module.sharedfile.entity.SharedFolder;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.text.Normalizer;
import java.util.*;
import com.cwgsyw.platform.module.authorization.ResourceAuthorizationInitializer;
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
    private final ResourceAuthorizationInitializer resourceAuthorizationInitializer;
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
        List<SharedFolderVO> visible = filterReadable(tree, user);
        applyCapabilities(visible, user);
        return visible;
    }

    @Transactional
    public SharedFolderVO createFolder(String tenantId, Long operatorId, String name, Long parentId,
                                       Long ownerGroupId) {
        folderMapper.lockFolderTree(tenantId);
        String normalizedName = normalizeName(name);
        requireUniqueName(tenantId, parentId, normalizedName, null);
        SharedFolder folder = new SharedFolder();
        folder.setTenantId(tenantId);
        folder.setName(name.trim());
        folder.setNormalizedName(normalizedName);
        folder.setParentId(parentId);
        folder.setAclInherited(true);
        folder.setCreatedBy(operatorId);
        folder.setCreatedAt(LocalDateTime.now());
        folder.setUpdatedAt(LocalDateTime.now());
        folderMapper.insert(folder);
        resourceAuthorizationInitializer.initialize(tenantId, "shared_folder", folder.getId(),
            operatorId, ownerGroupId, 02770);

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("shared_file").action("create_folder")
                .targetId(folder.getId()).targetType("shared_folder")
                .operatorId(operatorId).remark("name=" + name)
                .createdAt(LocalDateTime.now()).build());

        return toVO(folder);
    }

    @Transactional
    public SharedFolderVO updateFolder(String tenantId, Long operatorId, Long folderId, String requestedName,
                                       Long requestedParentId, boolean moveRequested) {
        folderMapper.lockFolderTree(tenantId);
        SharedFolder folder = requireFolder(tenantId, folderId);
        Long parentId = moveRequested ? requestedParentId : folder.getParentId();
        if (moveRequested && parentId != null) validateMove(tenantId, folderId, parentId);
        String name = requestedName == null ? folder.getName() : requestedName.trim();
        String normalizedName = requestedName == null ? folder.getNormalizedName() : normalizeName(requestedName);
        requireUniqueName(tenantId, parentId, normalizedName, folderId);
        boolean renamed = !Objects.equals(folder.getName(), name);
        boolean moved = moveRequested && !Objects.equals(folder.getParentId(), parentId);
        if (!renamed && !moved) return toVO(folder);
        Long oldParentId = folder.getParentId();
        folder.setName(name);
        folder.setNormalizedName(normalizedName);
        folder.setParentId(parentId);
        folder.setUpdatedAt(LocalDateTime.now());
        folderMapper.updateById(folder);
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId).module("shared_file").action(moved ? "move_folder" : "rename_folder")
            .targetId(folderId).targetType("shared_folder").operatorId(operatorId)
            .remark("oldParentId=" + oldParentId + ",newParentId=" + parentId + ",name=" + name)
            .createdAt(LocalDateTime.now()).build());
        return toVO(folder);
    }

    public SharedFolder getFolder(String tenantId, Long folderId) {
        return requireFolder(tenantId, folderId);
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
                folderMapper.lockFolderTree(tenantId);
                SharedFolder newFolder = new SharedFolder();
                newFolder.setTenantId(tenantId);
                newFolder.setName(part);
                newFolder.setNormalizedName(normalizeName(part));
                newFolder.setParentId(parentId);
                newFolder.setAclInherited(true);
                newFolder.setCreatedBy(operatorId);
                newFolder.setCreatedAt(LocalDateTime.now());
                newFolder.setUpdatedAt(LocalDateTime.now());
                folderMapper.insert(newFolder);
                resourceAuthorizationInitializer.initialize(tenantId, "shared_folder", newFolder.getId(),
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

    private SharedFolder requireFolder(String tenantId, Long folderId) {
        SharedFolder folder = folderMapper.selectById(folderId);
        if (folder == null || !tenantId.equals(folder.getTenantId())) {
            throw BusinessException.badRequest("SHARED_FOLDER_NOT_FOUND", "文件夹不存在");
        }
        return folder;
    }

    private void validateMove(String tenantId, Long folderId, Long parentId) {
        if (Objects.equals(folderId, parentId)) {
            throw BusinessException.badRequest("SHARED_FOLDER_MOVE_CYCLE", "不能移动到自身");
        }
        SharedFolder parent = requireFolder(tenantId, parentId);
        Long cursor = parent.getParentId();
        while (cursor != null) {
            if (Objects.equals(cursor, folderId)) {
                throw BusinessException.badRequest("SHARED_FOLDER_MOVE_CYCLE", "不能移动到子文件夹");
            }
            cursor = requireFolder(tenantId, cursor).getParentId();
        }
    }

    private String normalizeName(String name) {
        if (name == null) throw BusinessException.badRequest("SHARED_FOLDER_NAME_INVALID", "文件夹名称不能为空");
        String trimmed = Normalizer.normalize(name, Normalizer.Form.NFC).trim();
        if (trimmed.isEmpty()) throw BusinessException.badRequest("SHARED_FOLDER_NAME_INVALID", "文件夹名称不能为空");
        if (trimmed.length() > 255 || trimmed.indexOf('/') >= 0 || trimmed.indexOf('\\') >= 0
                || trimmed.chars().anyMatch(Character::isISOControl)) {
            throw BusinessException.badRequest("SHARED_FOLDER_NAME_INVALID", "文件夹名称格式不合法");
        }
        return trimmed.toLowerCase(Locale.ROOT);
    }

    private void requireUniqueName(String tenantId, Long parentId, String normalizedName, Long excludedId) {
        LambdaQueryWrapper<SharedFolder> query = new LambdaQueryWrapper<SharedFolder>()
            .eq(SharedFolder::getTenantId, tenantId)
            .eq(SharedFolder::getNormalizedName, normalizedName);
        if (parentId == null) query.isNull(SharedFolder::getParentId);
        else query.eq(SharedFolder::getParentId, parentId);
        if (excludedId != null) query.ne(SharedFolder::getId, excludedId);
        if (folderMapper.selectCount(query) > 0) {
            throw new BusinessException(409, "SHARED_FOLDER_NAME_CONFLICT", "当前目录已存在同名文件夹");
        }
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
            folder.setCanCreateChild(authorizationService.decide(user,
                "shared_file:manage", "shared_folder", folder.getId(), 3).isAllowed());
            folder.setCanUpload(authorizationService.decide(user,
                "shared_file:upload", "shared_folder", folder.getId(), 3).isAllowed());
            folder.setCanDelete(authorizationService.decideParent(user,
                "shared_file:delete", "shared_folder", folder.getId(), 3));
            folder.setCanUpdate(authorizationService.decideParent(user,
                "shared_file:update", "shared_folder", folder.getId(), 2));
            folder.setCanManageAcl(authorizationService.decide(user,
                "shared_file:manage_acl", "shared_folder", folder.getId(), 2).isAllowed());
            applyCapabilities(folder.getChildren(), user);
        }
    }

    private Long primaryGroupId(Long userId) {
        if (userId == null) return null;
        User user = userMapper.selectById(userId);
        return user == null ? null : user.getGroupId();
    }
}
