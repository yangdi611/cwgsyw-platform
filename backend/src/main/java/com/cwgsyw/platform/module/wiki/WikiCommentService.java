package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.wiki.dto.WikiCommentVO;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.wiki.entity.WikiPageComment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Wiki 页面评论服务。
 * <p>
 * 评论为页面阅读上下文中的轻量反馈：不进入正文、版本历史或发布审批流程。
 * 权限复用页面 read ACL（由 Controller 的 checkAcl 保证），Service 内再做
 * tenant/page 基础校验，避免被绕过。300 字上限前后端都校验。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class WikiCommentService {

    /** 评论内容最大长度（字符）。 */
    public static final int MAX_CONTENT_LENGTH = 300;

    private final WikiPageCommentMapper commentMapper;
    private final WikiPageMapper pageMapper;
    private final UserMapper userMapper;
    private final AuditLogMapper auditLogMapper;

    /** 第一阶段管理员口径：租户/平台管理员可删除任意评论。 */
    static boolean canManageAnyComment(String groupScope) {
        return "tenant".equals(groupScope) || "platform".equals(groupScope);
    }

    /** 删除权限：本人 或 管理员。 */
    static boolean canDelete(Long commentCreatedBy, Long currentUserId, String groupScope) {
        return Objects.equals(commentCreatedBy, currentUserId) || canManageAnyComment(groupScope);
    }

    private WikiPage requirePage(String tenantId, Long pageId) {
        WikiPage page = pageMapper.selectById(pageId);
        if (page == null || !tenantId.equals(page.getTenantId())) {
            throw new IllegalArgumentException("页面不存在: " + pageId);
        }
        return page;
    }

    /**
     * 分页查询评论，按 created_at DESC, id DESC 排序。
     * MyBatis-Plus selectPage 对 Boolean @TableLogic 字段 count 有 bug，
     * 统一用 selectCount + 手动 LIMIT/OFFSET。
     */
    public PageResult<WikiCommentVO> listComments(String tenantId, Long pageId, Long userId,
                                                  String groupScope, int page, int size) {
        requirePage(tenantId, pageId);
        int p = page < 1 ? 1 : page;
        int s = size < 1 ? 20 : Math.min(size, 50);
        int offset = (p - 1) * s;

        long total = commentMapper.selectCount(new LambdaQueryWrapper<WikiPageComment>()
                .eq(WikiPageComment::getTenantId, tenantId)
                .eq(WikiPageComment::getPageId, pageId));

        List<WikiPageComment> rows = commentMapper.selectList(new LambdaQueryWrapper<WikiPageComment>()
                .eq(WikiPageComment::getTenantId, tenantId)
                .eq(WikiPageComment::getPageId, pageId)
                .orderByDesc(WikiPageComment::getCreatedAt)
                .orderByDesc(WikiPageComment::getId)
                .last("LIMIT " + s + " OFFSET " + offset));

        Map<Long, String> nameMap = resolveNames(rows);
        boolean admin = canManageAnyComment(groupScope);
        List<WikiCommentVO> records = rows.stream()
                .map(c -> toVO(c, nameMap.get(c.getCreatedBy()),
                        admin || Objects.equals(c.getCreatedBy(), userId)))
                .collect(Collectors.toList());

        PageResult<WikiCommentVO> result = new PageResult<>();
        result.setRecords(records);
        result.setTotal(total);
        result.setPage(p);
        result.setSize(s);
        return result;
    }

    /** 批量解析评论人显示名，优先 realName，回退 username，避免逐条 N+1。 */
    private Map<Long, String> resolveNames(List<WikiPageComment> rows) {
        Set<Long> ids = rows.stream().map(WikiPageComment::getCreatedBy)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(ids).stream().collect(Collectors.toMap(
                User::getId, u -> u.getRealName() != null ? u.getRealName() : u.getUsername()));
    }

    private WikiCommentVO toVO(WikiPageComment c, String createdByName, boolean canDelete) {
        WikiCommentVO vo = new WikiCommentVO();
        vo.setId(c.getId());
        vo.setPageId(c.getPageId());
        vo.setContent(c.getContent());
        vo.setCreatedBy(c.getCreatedBy());
        vo.setCreatedByName(createdByName != null ? createdByName
                : (c.getCreatedBy() != null ? "用户#" + c.getCreatedBy() : "—"));
        vo.setCreatedAt(c.getCreatedAt());
        vo.setCanDelete(canDelete);
        return vo;
    }

    @Transactional
    public WikiCommentVO createComment(String tenantId, Long pageId, Long userId,
                                       String content, String groupScope) {
        requirePage(tenantId, pageId);
        if (content == null || content.trim().isEmpty()) {
            throw new IllegalArgumentException("评论内容不能为空");
        }
        String trimmed = content.trim();
        if (trimmed.length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException("评论不能超过 " + MAX_CONTENT_LENGTH + " 个字符");
        }

        LocalDateTime now = LocalDateTime.now();
        WikiPageComment c = new WikiPageComment();
        c.setTenantId(tenantId);
        c.setPageId(pageId);
        c.setContent(trimmed);
        c.setCreatedBy(userId);
        c.setCreatedAt(now);
        c.setUpdatedAt(now);
        commentMapper.insert(c);

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("wiki").action("comment_create")
                .targetId(c.getId()).targetType("wiki_page_comment").operatorId(userId)
                .remark("pageId=" + pageId)
                .createdAt(now).build());

        String name = userId == null ? null : Optional.ofNullable(userMapper.selectById(userId))
                .map(u -> u.getRealName() != null ? u.getRealName() : u.getUsername()).orElse(null);
        return toVO(c, name, true);
    }

    @Transactional
    public void deleteComment(String tenantId, Long pageId, Long commentId,
                              Long userId, String groupScope) {
        requirePage(tenantId, pageId);
        WikiPageComment c = commentMapper.selectOne(new LambdaQueryWrapper<WikiPageComment>()
                .eq(WikiPageComment::getId, commentId)
                .eq(WikiPageComment::getTenantId, tenantId)
                .eq(WikiPageComment::getPageId, pageId)
                .last("LIMIT 1"));
        // 已删除或不存在：幂等返回成功（@TableLogic 已过滤 is_deleted=true）
        if (c == null) return;

        if (!canDelete(c.getCreatedBy(), userId, groupScope)) {
            throw new AccessDeniedException("无权限删除该评论");
        }

        LocalDateTime now = LocalDateTime.now();
        c.setDeletedAt(now);
        c.setDeletedBy(userId);
        c.setUpdatedAt(now);
        commentMapper.updateById(c);       // 更新 deleted_* 字段
        commentMapper.deleteById(c.getId()); // @TableLogic 置 is_deleted=true

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("wiki").action("comment_delete")
                .targetId(c.getId()).targetType("wiki_page_comment").operatorId(userId)
                .remark("pageId=" + pageId)
                .createdAt(now).build());
    }
}
