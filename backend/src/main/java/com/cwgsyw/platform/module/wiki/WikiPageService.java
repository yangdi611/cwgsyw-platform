package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.wiki.dto.*;
import com.cwgsyw.platform.module.wiki.entity.WikiBacklink;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.wiki.entity.WikiPageVersion;
import com.cwgsyw.platform.module.wiki.entity.WikiSpace;
import com.cwgsyw.platform.security.SecurityUser;
import com.cwgsyw.platform.module.authorization.AuthorizationService;
import com.cwgsyw.platform.module.authorization.AuthorizationResourceMigrationService;
import com.cwgsyw.platform.module.workflow.adapter.WikiWorkflowAdapter;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowRuntimeFacade;
import com.cwgsyw.platform.module.workflow.runtime.WorkflowStartCommand;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class WikiPageService {

    private final WikiPageMapper pageMapper;
    private final WikiPageVersionMapper versionMapper;
    private final WikiSpaceMapper spaceMapper;
    private final WikiBacklinkMapper backlinkMapper;
    private final WikiBacklinkService backlinkService;
    private final WikiAclService aclService;
    private final WikiSpaceService spaceService;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;
    private final UserMapper userMapper;
    private final WorkflowRuntimeFacade workflowRuntimeFacade;
    private final AuthorizationService authorizationService;
    private final AuthorizationResourceMigrationService resourceMigrationService;
    private final WikiAttachmentService attachmentService;

    public List<WikiPageTreeVO> getTree(String tenantId, Long spaceId) {
        List<WikiPage> pages = pageMapper.selectList(new LambdaQueryWrapper<WikiPage>()
                .eq(WikiPage::getTenantId, tenantId)
                .eq(WikiPage::getSpaceId, spaceId)
                .orderByAsc(WikiPage::getSortOrder)
                .orderByAsc(WikiPage::getId));
        Map<Long, List<WikiPageTreeVO>> byParent = new HashMap<>();
        for (WikiPage p : pages) {
            WikiPageTreeVO vo = new WikiPageTreeVO();
            vo.setId(p.getId());
            vo.setTitle(p.getTitle());
            vo.setSlug(p.getSlug());
            vo.setStatus(p.getStatus());
            vo.setSortOrder(p.getSortOrder());
            vo.setSpaceId(p.getSpaceId());
            Long key = p.getParentId();
            byParent.computeIfAbsent(key, k -> new ArrayList<>()).add(vo);
        }
        attachChildren(byParent);
        return byParent.getOrDefault(null, new ArrayList<>());
    }

    private void attachChildren(Map<Long, List<WikiPageTreeVO>> byParent) {
        for (List<WikiPageTreeVO> list : byParent.values()) {
            for (WikiPageTreeVO vo : list) {
                List<WikiPageTreeVO> children = byParent.get(vo.getId());
                if (children != null) vo.setChildren(children);
            }
        }
    }

    public WikiPageVO getPage(String tenantId, Long pageId, SecurityUser user) {
        WikiPage page = requirePage(tenantId, pageId);
        return toVO(page, user);
    }

    public boolean exists(String tenantId, Long pageId) {
        WikiPage page = pageMapper.selectById(pageId);
        return page != null && !Boolean.TRUE.equals(page.getIsDeleted()) && tenantId.equals(page.getTenantId());
    }

    private WikiPageVO toVO(WikiPage page, SecurityUser user) {
        WikiPageVO vo = new WikiPageVO();
        vo.setId(page.getId());
        vo.setSpaceId(page.getSpaceId());
        vo.setParentId(page.getParentId());
        vo.setTitle(page.getTitle());
        vo.setSlug(page.getSlug());
        vo.setContent(page.getContent());
        vo.setStatus(page.getStatus());
        vo.setCurrentVersion(page.getCurrentVersion());
        vo.setAclCustom(Boolean.FALSE.equals(page.getAclInherited()));
        vo.setUpdatedAt(page.getUpdatedAt());
        if (page.getUpdatedBy() != null) {
            User u = userMapper.selectById(page.getUpdatedBy());
            if (u != null) vo.setUpdatedByName(u.getRealName() != null ? u.getRealName() : u.getUsername());
        }
        long bc = backlinkMapper.selectCount(new LambdaQueryWrapper<WikiBacklink>()
                .eq(WikiBacklink::getToPageId, page.getId()));
        vo.setBacklinkCount((int) bc);
        vo.setCanWrite(canDo(page, user, "write"));
        vo.setCanDelete(canDo(page, user, "delete"));
        vo.setCanPublish(canDo(page, user, "publish"));
        boolean legacyCanManageAcl = user.getPermissions().contains("wiki:manage_acl");
        vo.setCanManageAcl(authorizationService.decideWithCompatibility(user, "wiki", "wiki:manage_acl",
            "wiki_page", page.getId(), 2, legacyCanManageAcl));
        return vo;
    }

    private boolean canDo(WikiPage page, SecurityUser user, String action) {
        try {
            checkWritePermission(page.getTenantId(), page.getSpaceId(), page.getId(), user, action);
            return true;
        } catch (AccessDeniedException e) {
            return false;
        }
    }

    private boolean legacyAllows(WikiPage page, SecurityUser user, String action) {
        if (!user.getPermissions().contains("wiki:" + mapToSpaceAction(action))) return false;
        boolean spaceAllowed = spaceService.hasWritePermission(
            page.getTenantId(), page.getSpaceId(), user, mapToSpaceAction(action));
        return spaceAllowed || aclService.hasExplicitPermission(page.getTenantId(), page.getId(),
            user.getUserId(), user.getGroupId(), user.getGroupScope(), mapToPageAction(action));
    }

    /**
     * 页面写操作统一权限闸门：空间级 hasWritePermission OR 页面级 aclService.hasExplicitPermission，任一命中即放行（SPEC 7.3 节）。
     * 是不可绕过的强制调用点：失败直接抛异常，调用方无法"忘记检查返回值"（SPEC 3.1 节）。
     * 页面级判断用 hasExplicitPermission 而非 hasPermission——后者在页面链无自定义 ACL 时默认放行（为 read 可见性设计），
     * 若用来判断写权限会导致任何登录用户对未设置过页面级 ACL 的页面都拥有写/删/发布权限，绕过空间级 ACL。
     */
    private void checkWritePermission(String tenantId, Long spaceId, Long pageId, SecurityUser user, String action) {
        String permissionCode = "wiki:" + mapToSpaceAction(action);
        int requiredBits = "publish".equals(action) ? 6 : 2;
        boolean allowed = authorizationService.decideWithCompatibility(user, "wiki", permissionCode,
            "wiki_page", pageId, requiredBits, () -> {
                if (!user.getPermissions().contains(permissionCode)) return false;
                boolean spaceOk = spaceService.hasWritePermission(
                    tenantId, spaceId, user, mapToSpaceAction(action));
                return spaceOk || aclService.hasExplicitPermission(
                    tenantId, pageId, user.getUserId(), user.getGroupId(), user.getGroupScope(),
                    mapToPageAction(action));
            });
        if (!allowed) throw new AccessDeniedException("无权限在此页面执行 " + action);
    }

    /** 空间级动词固定为 create/update/delete/publish，页面级固定为 read/write/delete/publish，仅 update↔write 需要映射。 */
    private String mapToSpaceAction(String action) {
        return "write".equals(action) ? "update" : action;
    }

    private String mapToPageAction(String action) {
        return "update".equals(action) ? "write" : action;
    }

    @Transactional
    public WikiPageVO createPage(String tenantId, SecurityUser user, CreatePageRequest req) {
        String title = normalizeTitle(req.getTitle());
        if (req.getParentId() != null) {
            WikiPage parent = requirePage(tenantId, req.getParentId());
            if (!Objects.equals(parent.getSpaceId(), req.getSpaceId())) {
                throw new IllegalArgumentException("父页面不属于当前空间");
            }
            checkWritePermission(tenantId, req.getSpaceId(), req.getParentId(), user, "update");
        } else {
            spaceService.checkCanWrite(tenantId, req.getSpaceId(), user, "create");
        }
        ensureSiblingTitleAvailable(tenantId, req.getSpaceId(), req.getParentId(), title, null);
        Long userId = user.getUserId();
        WikiPage page = new WikiPage();
        page.setTenantId(tenantId);
        page.setSpaceId(req.getSpaceId());
        page.setParentId(req.getParentId());
        page.setTitle(title);
        page.setSlug(uniqueSlug(tenantId, req.getSpaceId(), slugify(title)));
        page.setContent("");
        page.setStatus("draft");
        page.setCurrentVersion(0);
        // 同级末尾追加：取当前同 parent 下最大 sort_order + 1，避免全为 0 导致顺序不稳定
        Integer maxSort = pageMapper.selectList(new LambdaQueryWrapper<WikiPage>()
                .eq(WikiPage::getTenantId, tenantId)
                .eq(WikiPage::getSpaceId, req.getSpaceId())
                .isNull(req.getParentId() == null, WikiPage::getParentId)
                .eq(req.getParentId() != null, WikiPage::getParentId, req.getParentId())
                .orderByDesc(WikiPage::getSortOrder)
                .last("LIMIT 1"))
                .stream().findFirst().map(WikiPage::getSortOrder).orElse(-1);
        page.setSortOrder(maxSort + 1);
        page.setAclInherited(true);
        page.setCreatedBy(userId);
        page.setUpdatedBy(userId);
        page.setCreatedAt(LocalDateTime.now());
        page.setUpdatedAt(LocalDateTime.now());
        pageMapper.insert(page);
        resourceMigrationService.initializeCreatedResource(tenantId, "wiki_page", page.getId(),
            userId, user.getGroupId(), 0670);

        auditLogMapper.insert(buildAudit(tenantId, "create", page.getId(), userId, null, toJson(page),
                "title=" + page.getTitle()));
        return toVO(page, user);
    }

    @Transactional
    public WikiPageVO savePage(String tenantId, SecurityUser user, Long pageId, SavePageRequest req) {
        WikiPage page = requirePage(tenantId, pageId);
        checkWritePermission(tenantId, page.getSpaceId(), pageId, user, "update");
        Long userId = user.getUserId();
        if ("archived".equals(page.getStatus())) throw new IllegalStateException("已归档页面不可编辑");
        String title = normalizeTitle(req.getTitle());
        ensureSiblingTitleAvailable(tenantId, page.getSpaceId(), page.getParentId(), title, pageId);
        String before = toJson(page);
        page.setTitle(title);
        page.setContent(req.getContent());
        page.setCurrentVersion(page.getCurrentVersion() == null ? 1 : page.getCurrentVersion() + 1);
        page.setUpdatedBy(userId);
        page.setUpdatedAt(LocalDateTime.now());
        pageMapper.updateById(page);

        backlinkService.rebuild(tenantId, pageId, req.getContent());
        saveVersion(tenantId, page, req.getComment(), userId);

        auditLogMapper.insert(buildAudit(tenantId, "update", pageId, userId, before, toJson(page),
                "version=" + page.getCurrentVersion()));
        return toVO(page, user);
    }

    @Transactional
    public void deletePage(String tenantId, Long pageId, SecurityUser user) {
        WikiPage page = requirePage(tenantId, pageId);
        authorizationService.requireParentWithCompatibility(user, "wiki", "wiki:delete",
            "wiki_page", pageId, 3, () -> legacyAllows(page, user, "delete"));
        Long userId = user.getUserId();
        List<Long> ids = pageMapper.findDescendantIds(pageId);
        attachmentService.deleteAttachmentsForPages(tenantId, userId, ids);
        for (Long id : ids) {
            WikiPage p = pageMapper.selectById(id);
            if (p == null || p.getIsDeleted()) continue;
            String before = toJson(p);
            pageMapper.deleteById(id);   // @TableLogic 逻辑删除
            auditLogMapper.insert(buildAudit(tenantId, "delete", id, userId, before, null,
                    "title=" + p.getTitle()));
        }
    }

    @Transactional
    public void movePage(String tenantId, Long pageId, Long newParentId, int sortOrder, SecurityUser user) {
        WikiPage page = requirePage(tenantId, pageId);
        authorizationService.requireParentWithCompatibility(user, "wiki", "wiki:update",
            "wiki_page", pageId, 3, () -> legacyAllows(page, user, "update"));
        String targetType = newParentId == null ? "wiki_space" : "wiki_page";
        Long targetId = newParentId == null ? page.getSpaceId() : newParentId;
        authorizationService.requireWithCompatibility(user, "wiki", "wiki:update",
            targetType, targetId, 3, () -> legacyAllows(page, user, "update"));
        Long userId = user.getUserId();
        if (newParentId != null) {
            List<Long> descendants = pageMapper.findDescendantIds(pageId);
            if (descendants.contains(newParentId)) {
                throw new IllegalArgumentException("不能移动到自身或子页面下");
            }
        }
        ensureSiblingTitleAvailable(tenantId, page.getSpaceId(), newParentId, page.getTitle(), pageId);
        String before = toJson(page);
        page.setParentId(newParentId);
        page.setSortOrder(sortOrder);
        page.setUpdatedBy(userId);
        page.setUpdatedAt(LocalDateTime.now());
        pageMapper.updateById(page);
        auditLogMapper.insert(buildAudit(tenantId, "move", pageId, userId, before, toJson(page),
                "parentId=" + newParentId));
    }

    public List<WikiVersionVO> listVersions(Long pageId) {
        List<WikiPageVersion> versions = versionMapper.selectList(new LambdaQueryWrapper<WikiPageVersion>()
                .eq(WikiPageVersion::getPageId, pageId)
                .orderByDesc(WikiPageVersion::getVersion));
        return versions.stream().map(v -> {
            WikiVersionVO vo = new WikiVersionVO();
            vo.setVersion(v.getVersion());
            vo.setTitle(v.getTitle());
            vo.setComment(v.getComment());
            vo.setCreatedAt(v.getCreatedAt());
            if (v.getCreatedBy() != null) {
                User u = userMapper.selectById(v.getCreatedBy());
                if (u != null) vo.setCreatedByName(u.getRealName() != null ? u.getRealName() : u.getUsername());
            }
            return vo;
        }).collect(Collectors.toList());
    }

    public WikiPageVersion getVersionForExport(String tenantId, Long pageId, int version) {
        WikiPageVersion snapshot = versionMapper.selectOne(new LambdaQueryWrapper<WikiPageVersion>()
                .eq(WikiPageVersion::getTenantId, tenantId)
                .eq(WikiPageVersion::getPageId, pageId)
                .eq(WikiPageVersion::getVersion, version)
                .last("LIMIT 1"));
        if (snapshot == null) throw new IllegalArgumentException("版本不存在: " + version);
        return snapshot;
    }

    @Transactional
    public WikiPageVO revert(String tenantId, Long pageId, int version, SecurityUser user) {
        WikiPageVersion v = versionMapper.selectOne(new LambdaQueryWrapper<WikiPageVersion>()
                .eq(WikiPageVersion::getPageId, pageId)
                .eq(WikiPageVersion::getVersion, version)
                .last("LIMIT 1"));
        if (v == null) throw new IllegalArgumentException("版本不存在: " + version);
        if (v.getTitle() == null || v.getTitle().isBlank() || v.getContent() == null || v.getContent().isBlank()) {
            throw new IllegalStateException("版本快照内容不完整，无法回退: " + version);
        }
        SavePageRequest req = new SavePageRequest();
        req.setTitle(v.getTitle());
        req.setContent(v.getContent());
        req.setComment("回滚到版本 " + version);
        return savePage(tenantId, user, pageId, req);
    }

    public PageResult<WikiSearchResultVO> search(String tenantId, String keyword, Long spaceId,
                                                int page, int size, SecurityUser user) {
        if (authorizationService.isEnforced(user, "wiki")) {
            return searchWithEnforcedAccess(tenantId, keyword, spaceId, page, size, user);
        }
        int offset = (page - 1) * size;
        long total;
        List<Map<String, Object>> rows;
        if (spaceId != null) {
            total = pageMapper.searchCountInSpace(tenantId, spaceId, keyword);
            rows = pageMapper.searchInSpace(tenantId, spaceId, keyword, size, offset);
        } else {
            total = pageMapper.searchCount(tenantId, keyword);
            rows = pageMapper.search(tenantId, keyword, size, offset);
        }
        List<WikiSearchResultVO> records = toSearchResults(rows);

        PageResult<WikiSearchResultVO> result = new PageResult<>();
        result.setRecords(records);
        result.setTotal(total);
        result.setPage(page);
        result.setSize(size);
        return result;
    }

    private PageResult<WikiSearchResultVO> searchWithEnforcedAccess(String tenantId, String keyword, Long spaceId,
                                                                      int page, int size, SecurityUser user) {
        List<Map<String, Object>> candidates = spaceId != null
            ? pageMapper.searchInSpace(tenantId, spaceId, keyword, Integer.MAX_VALUE, 0)
            : pageMapper.search(tenantId, keyword, Integer.MAX_VALUE, 0);
        List<WikiSearchResultVO> visible = toSearchResults(candidates).stream()
            .filter(result -> authorizationService.decide(user, "wiki:read", "wiki_page", result.getPageId(), 4)
                .isAllowed())
            .toList();
        int offset = Math.min((page - 1) * size, visible.size());
        int end = Math.min(offset + size, visible.size());
        PageResult<WikiSearchResultVO> result = new PageResult<>();
        result.setRecords(visible.subList(offset, end));
        result.setTotal(visible.size());
        result.setPage(page);
        result.setSize(size);
        return result;
    }

    private List<WikiSearchResultVO> toSearchResults(List<Map<String, Object>> rows) {
        return rows.stream().map(r -> {
            WikiSearchResultVO vo = new WikiSearchResultVO();
            vo.setPageId(((Number) r.get("id")).longValue());
            Object sid = r.get("space_id");
            vo.setSpaceId(sid != null ? ((Number) sid).longValue() : null);
            vo.setTitle((String) r.get("title"));
            vo.setHighlight((String) r.get("highlight"));
            Object ua = r.get("updated_at");
            if (ua instanceof java.sql.Timestamp ts) vo.setUpdatedAt(ts.toLocalDateTime());
            else if (ua instanceof LocalDateTime ldt) vo.setUpdatedAt(ldt);
            return vo;
        }).collect(Collectors.toList());
    }

    @Transactional
    public void publishDirect(String tenantId, Long pageId, SecurityUser user) {
        WikiPage page = requirePage(tenantId, pageId);
        checkWritePermission(tenantId, page.getSpaceId(), pageId, user, "publish");
        Long userId = user.getUserId();
        String before = toJson(page);
        page.setStatus("published");
        page.setUpdatedBy(userId);
        page.setUpdatedAt(LocalDateTime.now());
        pageMapper.updateById(page);
        auditLogMapper.insert(buildAudit(tenantId, "publish", pageId, userId, before, toJson(page),
                "title=" + page.getTitle()));
        notificationService.notify(tenantId, page.getCreatedBy(), "Wiki 已发布",
                "《" + page.getTitle() + "》已发布。", "wiki_publish", "wiki_page", pageId);
    }

    @Transactional
    public void submitForReview(String tenantId, Long pageId, SecurityUser user) {
        WikiPage page = requirePage(tenantId, pageId);
        checkWritePermission(tenantId, page.getSpaceId(), pageId, user, "publish");
        Long userId = user.getUserId();
        if (!"draft".equals(page.getStatus())) throw new IllegalStateException("仅草稿可提交审批");
        WikiSpace space = spaceMapper.selectById(page.getSpaceId());
        // 只读型系统空间（手册/Release Notes）不可提交审批；Bug 反馈（write_scope=all）放行
        if (space != null && space.getSeedKey() != null
                && !"all".equals(space.getWriteScope())) {
            throw new IllegalStateException("系统手册页面由平台维护，不可提交审批");
        }
        String before = toJson(page);
        var instance = workflowRuntimeFacade.startBusinessProcess(WorkflowStartCommand.builder()
            .tenantId(tenantId)
            .businessType(WikiWorkflowAdapter.BUSINESS_TYPE)
            .businessId(String.valueOf(pageId))
            .submitterId(userId)
            .build());
        page.setStatus("review");
        page.setProcessInstanceId(instance.getProcessInstanceId());
        page.setUpdatedBy(userId);
        page.setUpdatedAt(LocalDateTime.now());
        pageMapper.updateById(page);
        auditLogMapper.insert(buildAudit(tenantId, "submit", pageId, userId, before, toJson(page),
                "processInstanceId=" + instance.getProcessInstanceId()));
    }

    @Transactional
    public WikiPage handleApprovalResult(String processInstId, Long pageId, boolean approved, String comment) {
        WikiPage page = pageMapper.selectById(pageId);
        if (page == null) return null;
        String before = toJson(page);
        page.setStatus(approved ? "published" : "draft");
        page.setProcessInstanceId(null);
        page.setUpdatedAt(LocalDateTime.now());
        pageMapper.updateById(page);
        auditLogMapper.insert(buildAudit(page.getTenantId(), approved ? "approve" : "reject", pageId, 0L,
                before, toJson(page), comment));
        return page;
    }

    public GraphVO getGraph(String tenantId, Long spaceId) {
        List<WikiPage> pages = pageMapper.selectList(new LambdaQueryWrapper<WikiPage>()
                .eq(WikiPage::getTenantId, tenantId)
                .eq(WikiPage::getSpaceId, spaceId)
                .eq(WikiPage::getStatus, "published"));
        GraphVO graph = new GraphVO();
        Set<Long> ids = new HashSet<>();
        for (WikiPage p : pages) {
            ids.add(p.getId());
            GraphVO.Node node = new GraphVO.Node();
            node.setId(p.getId());
            node.setTitle(p.getTitle());
            node.setStatus(p.getStatus());
            graph.getNodes().add(node);
        }
        if (ids.isEmpty()) return graph;
        List<WikiBacklink> links = backlinkMapper.selectList(new LambdaQueryWrapper<WikiBacklink>()
                .eq(WikiBacklink::getTenantId, tenantId)
                .in(WikiBacklink::getFromPageId, ids));
        for (WikiBacklink bl : links) {
            if (!ids.contains(bl.getToPageId())) continue;
            GraphVO.Edge edge = new GraphVO.Edge();
            edge.setSource(bl.getFromPageId());
            edge.setTarget(bl.getToPageId());
            graph.getEdges().add(edge);
        }
        return graph;
    }

    private void saveVersion(String tenantId, WikiPage page, String comment, Long userId) {
        WikiPageVersion v = new WikiPageVersion();
        v.setTenantId(tenantId);
        v.setPageId(page.getId());
        v.setVersion(page.getCurrentVersion());
        v.setTitle(page.getTitle());
        v.setContent(page.getContent());
        v.setComment(comment);
        v.setCreatedBy(userId);
        v.setCreatedAt(LocalDateTime.now());
        versionMapper.insert(v);
    }

    private WikiPage requirePage(String tenantId, Long pageId) {
        WikiPage page = pageMapper.selectById(pageId);
        if (page == null || Boolean.TRUE.equals(page.getIsDeleted()) || !tenantId.equals(page.getTenantId())) {
            throw new IllegalArgumentException("页面不存在: " + pageId);
        }
        return page;
    }

    private AuditLog buildAudit(String tenantId, String action, Long targetId, Long operatorId,
                                String before, String after, String remark) {
        return AuditLog.builder()
                .tenantId(tenantId).module("wiki").action(action)
                .targetId(targetId).targetType("wiki_page").operatorId(operatorId)
                .beforeJson(before).afterJson(after).remark(remark)
                .createdAt(LocalDateTime.now()).build();
    }

    private String slugify(String title) {
        if (title == null) return "page";
        String s = title.toLowerCase().replaceAll("[^a-z0-9\\u4e00-\\u9fff]+", "-")
                .replaceAll("(^-+)|(-+$)", "");
        return s.isEmpty() ? "page" : s;
    }

    private String normalizeTitle(String title) {
        if (title == null) throw new IllegalArgumentException("页面标题不能为空");
        String normalized = title.trim();
        if (normalized.isEmpty()) throw new IllegalArgumentException("页面标题不能为空");
        if (normalized.length() > 255) throw new IllegalArgumentException("页面标题不能超过 255 个字符");
        return normalized;
    }

    private void ensureSiblingTitleAvailable(String tenantId, Long spaceId, Long parentId,
                                             String title, Long currentPageId) {
        LambdaQueryWrapper<WikiPage> query = new LambdaQueryWrapper<WikiPage>()
                .eq(WikiPage::getTenantId, tenantId)
                .eq(WikiPage::getSpaceId, spaceId)
                .eq(WikiPage::getTitle, title)
                .isNull(parentId == null, WikiPage::getParentId)
                .eq(parentId != null, WikiPage::getParentId, parentId);
        if (currentPageId != null) query.ne(WikiPage::getId, currentPageId);
        if (pageMapper.selectCount(query) > 0) {
            throw new BusinessException(409, "WIKI_PAGE_SIBLING_TITLE_CONFLICT", "同级页面标题已存在");
        }
    }

    private String uniqueSlug(String tenantId, Long spaceId, String base) {
        String slug = base;
        int i = 1;
        while (pageMapper.selectCount(new LambdaQueryWrapper<WikiPage>()
                .eq(WikiPage::getTenantId, tenantId)
                .eq(WikiPage::getSpaceId, spaceId)
                .eq(WikiPage::getSlug, slug)) > 0) {
            slug = base + "-" + (++i);
        }
        return slug;
    }

    private String toJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); } catch (Exception e) { return "{}"; }
    }
}
