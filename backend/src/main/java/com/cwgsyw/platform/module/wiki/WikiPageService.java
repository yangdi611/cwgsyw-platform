package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
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
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.RuntimeService;
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
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;
    private final UserMapper userMapper;
    private final RuntimeService runtimeService;

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

    public WikiPageVO getPage(String tenantId, Long pageId, Long userId) {
        WikiPage page = requirePage(tenantId, pageId);
        return toVO(page);
    }

    private WikiPageVO toVO(WikiPage page) {
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
        return vo;
    }

    @Transactional
    public WikiPageVO createPage(String tenantId, Long userId, CreatePageRequest req) {
        WikiPage page = new WikiPage();
        page.setTenantId(tenantId);
        page.setSpaceId(req.getSpaceId());
        page.setParentId(req.getParentId());
        page.setTitle(req.getTitle());
        page.setSlug(uniqueSlug(tenantId, req.getSpaceId(), slugify(req.getTitle())));
        page.setContent("");
        page.setStatus("draft");
        page.setCurrentVersion(1);
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

        saveVersion(tenantId, page, "", userId);

        auditLogMapper.insert(buildAudit(tenantId, "create", page.getId(), userId, null, toJson(page),
                "title=" + page.getTitle()));
        return toVO(page);
    }

    @Transactional
    public WikiPageVO savePage(String tenantId, Long userId, Long pageId, SavePageRequest req) {
        WikiPage page = requirePage(tenantId, pageId);
        if ("archived".equals(page.getStatus())) throw new IllegalStateException("已归档页面不可编辑");
        String before = toJson(page);
        page.setTitle(req.getTitle());
        page.setContent(req.getContent());
        page.setCurrentVersion(page.getCurrentVersion() == null ? 1 : page.getCurrentVersion() + 1);
        page.setUpdatedBy(userId);
        page.setUpdatedAt(LocalDateTime.now());
        pageMapper.updateById(page);

        backlinkService.rebuild(tenantId, pageId, req.getContent());
        saveVersion(tenantId, page, req.getComment(), userId);

        auditLogMapper.insert(buildAudit(tenantId, "update", pageId, userId, before, toJson(page),
                "version=" + page.getCurrentVersion()));
        return toVO(page);
    }

    @Transactional
    public void deletePage(String tenantId, Long pageId, Long userId) {
        WikiPage page = requirePage(tenantId, pageId);
        List<Long> ids = pageMapper.findDescendantIds(pageId);
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
    public void movePage(String tenantId, Long pageId, Long newParentId, int sortOrder, Long userId) {
        WikiPage page = requirePage(tenantId, pageId);
        if (newParentId != null) {
            List<Long> descendants = pageMapper.findDescendantIds(pageId);
            if (descendants.contains(newParentId)) {
                throw new IllegalArgumentException("不能移动到自身或子页面下");
            }
        }
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

    @Transactional
    public WikiPageVO revert(String tenantId, Long pageId, int version, Long userId) {
        WikiPageVersion v = versionMapper.selectOne(new LambdaQueryWrapper<WikiPageVersion>()
                .eq(WikiPageVersion::getPageId, pageId)
                .eq(WikiPageVersion::getVersion, version)
                .last("LIMIT 1"));
        if (v == null) throw new IllegalArgumentException("版本不存在: " + version);
        SavePageRequest req = new SavePageRequest();
        req.setTitle(v.getTitle());
        req.setContent(v.getContent());
        req.setComment("回滚到版本 " + version);
        return savePage(tenantId, userId, pageId, req);
    }

    public PageResult<WikiSearchResultVO> search(String tenantId, String keyword, Long spaceId, int page, int size) {
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
        List<WikiSearchResultVO> records = rows.stream().map(r -> {
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

        PageResult<WikiSearchResultVO> result = new PageResult<>();
        result.setRecords(records);
        result.setTotal(total);
        result.setPage(page);
        result.setSize(size);
        return result;
    }

    @Transactional
    public void publishDirect(String tenantId, Long pageId, Long userId) {
        WikiPage page = requirePage(tenantId, pageId);
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
    public void submitForReview(String tenantId, Long pageId, Long userId) {
        WikiPage page = requirePage(tenantId, pageId);
        if (!"draft".equals(page.getStatus())) throw new IllegalStateException("仅草稿可提交审批");
        WikiSpace space = spaceMapper.selectById(page.getSpaceId());
        if (space != null && space.getSeedKey() != null) {
            throw new IllegalStateException("系统手册页面由平台维护，不可提交审批");
        }
        String before = toJson(page);
        Map<String, Object> vars = new HashMap<>();
        vars.put("pageId", pageId);
        vars.put("tenantId", tenantId);
        vars.put("submitterId", userId);
        var pi = runtimeService.startProcessInstanceByKey("wiki_publish", "wikiPage:" + pageId, vars);
        page.setStatus("review");
        page.setProcessInstanceId(pi.getProcessInstanceId());
        page.setUpdatedBy(userId);
        page.setUpdatedAt(LocalDateTime.now());
        pageMapper.updateById(page);
        auditLogMapper.insert(buildAudit(tenantId, "submit", pageId, userId, before, toJson(page),
                "processInstanceId=" + pi.getProcessInstanceId()));
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
        if (page == null || !tenantId.equals(page.getTenantId())) {
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
