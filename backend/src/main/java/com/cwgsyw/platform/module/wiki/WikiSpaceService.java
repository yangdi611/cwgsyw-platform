package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.wiki.dto.WikiSpaceVO;
import com.cwgsyw.platform.module.wiki.entity.WikiSpace;
import com.cwgsyw.platform.security.SecurityUser;
import com.cwgsyw.platform.module.authorization.AuthorizationService;
import com.cwgsyw.platform.module.authorization.ResourceAuthorizationInitializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WikiSpaceService {

    private final WikiSpaceMapper spaceMapper;
    private final WikiPageMapper pageMapper;
    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;
    private final ObjectMapper objectMapper;
    private final AuthorizationService authorizationService;
    private final ResourceAuthorizationInitializer resourceAuthorizationInitializer;

    public List<WikiSpaceVO> listSpaces(String tenantId, SecurityUser user) {
        List<WikiSpace> spaces = spaceMapper.selectList(new LambdaQueryWrapper<WikiSpace>()
                .eq(WikiSpace::getTenantId, tenantId));
        return spaces.stream().filter(space -> canReadSpace(space.getId(), user)).map(s -> {
            long count = pageMapper.selectCount(new LambdaQueryWrapper<
                    com.cwgsyw.platform.module.wiki.entity.WikiPage>()
                    .eq(com.cwgsyw.platform.module.wiki.entity.WikiPage::getSpaceId, s.getId()));
            User creator = userMapper.selectById(s.getCreatedBy());
            return toVO(s, count, creator, user);
        }).collect(Collectors.toList());
    }

    public boolean canReadSpace(Long spaceId, SecurityUser user) {
        return authorizationService.decide(user, "wiki:read", "wiki_space", spaceId, 5).isAllowed();
    }

    public boolean exists(String tenantId, Long spaceId) {
        WikiSpace space = spaceMapper.selectById(spaceId);
        return space != null && !Boolean.TRUE.equals(space.getIsDeleted()) && tenantId.equals(space.getTenantId());
    }

    @Transactional
    public WikiSpaceVO createSpace(String tenantId, SecurityUser user, String name, String description,
                                   Long ownerGroupId) {
        Long userId = user.getUserId();
        WikiSpace space = new WikiSpace();
        space.setTenantId(tenantId);
        space.setName(name);
        space.setDescription(description);
        space.setCreatedBy(userId);
        space.setCreatedAt(LocalDateTime.now());
        space.setUpdatedAt(LocalDateTime.now());
        spaceMapper.insert(space);
        resourceAuthorizationInitializer.initialize(tenantId, "wiki_space", space.getId(),
            userId, ownerGroupId, 02770);
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("wiki").action("create")
                .targetId(space.getId()).targetType("wiki_space").operatorId(userId)
                .afterJson(toJson(space)).createdAt(LocalDateTime.now()).build());
        User creator = userMapper.selectById(userId);
        return toVO(space, 0L, creator, user);
    }

    @Transactional
    public WikiSpaceVO updateSpace(String tenantId, Long spaceId, SecurityUser user, String name, String description) {
        WikiSpace space = requireSpace(tenantId, spaceId);
        checkCanWrite(tenantId, spaceId, user, "update");
        Long userId = user.getUserId();
        String before = toJson(space);
        space.setName(name);
        space.setDescription(description);
        space.setUpdatedBy(userId);
        space.setUpdatedAt(LocalDateTime.now());
        spaceMapper.updateById(space);
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("wiki").action("update")
                .targetId(spaceId).targetType("wiki_space").operatorId(userId)
                .beforeJson(before).afterJson(toJson(space)).createdAt(LocalDateTime.now()).build());
        long count = pageMapper.selectCount(new LambdaQueryWrapper<
                com.cwgsyw.platform.module.wiki.entity.WikiPage>()
                .eq(com.cwgsyw.platform.module.wiki.entity.WikiPage::getSpaceId, spaceId));
        User creator = userMapper.selectById(space.getCreatedBy());
        return toVO(space, count, creator, user);
    }

    @Transactional
    public void deleteSpace(String tenantId, Long spaceId, Long userId) {
        WikiSpace space = spaceMapper.selectById(spaceId);
        if (space == null || !tenantId.equals(space.getTenantId())) throw new IllegalArgumentException("空间不存在");
        long count = pageMapper.selectCount(new LambdaQueryWrapper<
                com.cwgsyw.platform.module.wiki.entity.WikiPage>()
                .eq(com.cwgsyw.platform.module.wiki.entity.WikiPage::getSpaceId, spaceId));
        if (count > 0) throw new IllegalStateException("空间非空，请先删除全部页面");
        String before = toJson(space);
        spaceMapper.deleteById(spaceId);   // @TableLogic 逻辑删除
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("wiki").action("delete")
                .targetId(spaceId).targetType("wiki_space").operatorId(userId)
                .beforeJson(before).createdAt(LocalDateTime.now()).build());
    }

    /**
     * 空间级写权限判定。系统空间（seedKey != null）必须最先判断，且完全独立于 admin/角色原生权限——
     * 此前的判断顺序是 admin → 角色原生权限 → 系统空间短路 → 创建人 → 空间 ACL，导致任何带 wiki:update
     * 等原生权限的角色（甚至 admin/super_admin 本身）都能绕过系统空间的锁定，2026-07-06 修复：
     *   - write_scope=all（Bug 反馈与建议）：所有登录用户可 create/update/publish；delete 仅 admin/super_admin
     *     （管理员保留清理垃圾/违规反馈的能力，其余人不可删，防止误删他人反馈）
     *   - 其余取值（none/super_admin_only，平台使用手册/Release Notes）：任何人（含 admin/super_admin）
     *     都不可创建/写/改/删/发布，只能通过评论反馈——内容由 WikiManualSeeder 从 manifest.yaml 单向维护，
     *     开放 UI 编辑会与源文件产生分歧
     * 用户自建空间（seedKey == null）维持原判定顺序：admin → 角色自带权限 → 创建人 → 空间 ACL 命中，
     * 任一满足即放行（见 SPEC 6.1 节）。步骤 2（角色自带权限）是对 PRD 5.2 节伪代码遗漏分支的修正，
     * 缺了这一步会导致现有 member/group_leader 角色的正常编辑能力被整体回归。
     * 返回 boolean 而非直接抛异常——便于在 WikiPageService.checkWritePermission 中与页面级 ACL 做 OR 组合判断。
     */
    public boolean hasWritePermission(String tenantId, Long spaceId, SecurityUser user, String action) {
        WikiSpace space = spaceMapper.selectById(spaceId);
        if (space == null || !tenantId.equals(space.getTenantId())) {
            throw new IllegalArgumentException("空间不存在: " + spaceId);
        }
        String permissionCode = "wiki:" + action;
        int requiredBits = "create".equals(action) ? 3 : 2;
        return authorizationService.decide(user, permissionCode,
            "wiki_space", spaceId, requiredBits).isAllowed();
    }

    /**
     * checkCanWrite = hasWritePermission 的强制版本，供只需要单一空间级判断（不需要叠加页面级 ACL）
     * 的调用点直接使用，例如 updateSpace（空间本身没有页面级 ACL 概念）。
     * 失败直接抛 AccessDeniedException，调用方不必再手动检查返回值。
     */
    public void checkCanWrite(String tenantId, Long spaceId, SecurityUser user, String action) {
        if (!hasWritePermission(tenantId, spaceId, user, action)) {
            throw new AccessDeniedException("无权限在此空间执行 " + action);
        }
    }

    private WikiSpace requireSpace(String tenantId, Long spaceId) {
        WikiSpace space = spaceMapper.selectById(spaceId);
        if (space == null || !tenantId.equals(space.getTenantId())) {
            throw new IllegalArgumentException("空间不存在: " + spaceId);
        }
        return space;
    }

    private WikiSpaceVO toVO(WikiSpace s, long pageCount, User creator, SecurityUser currentUser) {
        WikiSpaceVO vo = new WikiSpaceVO();
        vo.setId(s.getId());
        vo.setName(s.getName());
        vo.setDescription(s.getDescription());
        vo.setPageCount(pageCount);
        vo.setUpdatedAt(s.getUpdatedAt());
        vo.setCreatedByName(creator != null ?
                (creator.getRealName() != null ? creator.getRealName() : creator.getUsername()) : null);
        vo.setSystem(s.getSeedKey() != null);
        vo.setWriteScope(s.getWriteScope());
        // 只读：系统空间且写范围不是 all（none/super_admin_only 均为锁定，任何人都不可写，见 hasWritePermission）
        vo.setReadOnly(s.getWriteScope() != null && !"all".equals(s.getWriteScope()));
        vo.setCreatedBy(s.getCreatedBy());
        vo.setCanManageAcl(authorizationService.decide(currentUser,
            "wiki:manage_acl", "wiki_space", s.getId(), 2).isAllowed());
        vo.setCanCreatePage(hasWritePermission(s.getTenantId(), s.getId(), currentUser, "create"));
        return vo;
    }

    private String toJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); } catch (Exception e) { return "{}"; }
    }
}
