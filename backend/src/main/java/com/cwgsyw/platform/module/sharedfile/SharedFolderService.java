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

@Service
@RequiredArgsConstructor
public class SharedFolderService {

    private final SharedFolderMapper folderMapper;
    private final SharedFileMapper fileMapper;
    private final AuditLogMapper auditLogMapper;

    public List<SharedFolderVO> getFolderTree(String tenantId) {
        List<SharedFolder> all = folderMapper.findAllByTenant(tenantId);
        Map<Long, SharedFolderVO> voMap = new LinkedHashMap<>();
        for (SharedFolder f : all) {
            SharedFolderVO vo = new SharedFolderVO();
            vo.setId(f.getId());
            vo.setName(f.getName());
            vo.setParentId(f.getParentId());
            vo.setChildren(new ArrayList<>());
            voMap.put(f.getId(), vo);
        }
        List<SharedFolderVO> roots = new ArrayList<>();
        for (SharedFolderVO vo : voMap.values()) {
            if (vo.getParentId() == null) {
                roots.add(vo);
            } else {
                SharedFolderVO parent = voMap.get(vo.getParentId());
                if (parent != null) {
                    parent.getChildren().add(vo);
                } else {
                    roots.add(vo);
                }
            }
        }
        return roots;
    }

    @Transactional
    public SharedFolderVO createFolder(String tenantId, Long operatorId, String name, Long parentId) {
        SharedFolder folder = new SharedFolder();
        folder.setTenantId(tenantId);
        folder.setName(name);
        folder.setParentId(parentId);
        folder.setCreatedBy(operatorId);
        folder.setCreatedAt(LocalDateTime.now());
        folder.setUpdatedAt(LocalDateTime.now());
        folderMapper.insert(folder);

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("shared_file").action("create_folder")
                .targetId(folder.getId()).targetType("shared_folder")
                .operatorId(operatorId).remark("name=" + name)
                .createdAt(LocalDateTime.now()).build());

        SharedFolderVO vo = new SharedFolderVO();
        vo.setId(folder.getId());
        vo.setName(folder.getName());
        vo.setParentId(folder.getParentId());
        vo.setChildren(new ArrayList<>());
        return vo;
    }

    @Transactional
    public void deleteFolder(String tenantId, Long folderId, Long operatorId) {
        SharedFolder folder = folderMapper.selectById(folderId);
        if (folder == null || !tenantId.equals(folder.getTenantId())) {
            throw new IllegalArgumentException("文件夹不存在: " + folderId);
        }

        // Soft-delete the folder itself
        folder.setIsDeleted(true);
        folder.setDeletedAt(LocalDateTime.now());
        folder.setDeletedBy(operatorId);
        folderMapper.deleteById(folderId);

        // Soft-delete all files in this folder
        List<SharedFile> files = fileMapper.selectList(new LambdaQueryWrapper<SharedFile>()
                .eq(SharedFile::getTenantId, tenantId)
                .eq(SharedFile::getFolderId, folderId));
        for (SharedFile file : files) {
            fileMapper.deleteById(file.getId());
        }

        // Recursively soft-delete child folders
        List<SharedFolder> children = folderMapper.selectList(new LambdaQueryWrapper<SharedFolder>()
                .eq(SharedFolder::getTenantId, tenantId)
                .eq(SharedFolder::getParentId, folderId));
        for (SharedFolder child : children) {
            deleteFolder(tenantId, child.getId(), operatorId);
        }

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
            if (parentId != null) {
                qw.eq(SharedFolder::getParentId, parentId);
            } else {
                qw.isNull(SharedFolder::getParentId);
            }
            SharedFolder existing = folderMapper.selectOne(qw);
            if (existing != null) {
                current = existing;
                parentId = existing.getId();
            } else {
                SharedFolder newFolder = new SharedFolder();
                newFolder.setTenantId(tenantId);
                newFolder.setName(part);
                newFolder.setParentId(parentId);
                newFolder.setCreatedBy(operatorId);
                newFolder.setCreatedAt(LocalDateTime.now());
                newFolder.setUpdatedAt(LocalDateTime.now());
                folderMapper.insert(newFolder);
                current = newFolder;
                parentId = newFolder.getId();
            }
        }
        return current;
    }
}
