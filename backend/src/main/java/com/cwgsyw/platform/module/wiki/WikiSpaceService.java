package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.wiki.dto.WikiSpaceVO;
import com.cwgsyw.platform.module.wiki.entity.WikiSpace;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
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

    public List<WikiSpaceVO> listSpaces(String tenantId) {
        List<WikiSpace> spaces = spaceMapper.selectList(new LambdaQueryWrapper<WikiSpace>()
                .eq(WikiSpace::getTenantId, tenantId));
        return spaces.stream().map(s -> {
            long count = pageMapper.selectCount(new LambdaQueryWrapper<
                    com.cwgsyw.platform.module.wiki.entity.WikiPage>()
                    .eq(com.cwgsyw.platform.module.wiki.entity.WikiPage::getSpaceId, s.getId()));
            User creator = userMapper.selectById(s.getCreatedBy());
            return toVO(s, count, creator);
        }).collect(Collectors.toList());
    }

    @Transactional
    public WikiSpaceVO createSpace(String tenantId, Long userId, String name, String description) {
        WikiSpace space = new WikiSpace();
        space.setTenantId(tenantId);
        space.setName(name);
        space.setDescription(description);
        space.setCreatedBy(userId);
        space.setCreatedAt(LocalDateTime.now());
        space.setUpdatedAt(LocalDateTime.now());
        spaceMapper.insert(space);
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("wiki").action("create")
                .targetId(space.getId()).targetType("wiki_space").operatorId(userId)
                .afterJson(toJson(space)).createdAt(LocalDateTime.now()).build());
        User creator = userMapper.selectById(userId);
        return toVO(space, 0L, creator);
    }

    @Transactional
    public WikiSpaceVO updateSpace(String tenantId, Long spaceId, Long userId, String name, String description) {
        WikiSpace space = spaceMapper.selectById(spaceId);
        if (space == null || !tenantId.equals(space.getTenantId())) throw new IllegalArgumentException("空间不存在");
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
        return toVO(space, count, creator);
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

    private WikiSpaceVO toVO(WikiSpace s, long pageCount, User creator) {
        WikiSpaceVO vo = new WikiSpaceVO();
        vo.setId(s.getId());
        vo.setName(s.getName());
        vo.setDescription(s.getDescription());
        vo.setPageCount(pageCount);
        vo.setUpdatedAt(s.getUpdatedAt());
        vo.setCreatedByName(creator != null ?
                (creator.getRealName() != null ? creator.getRealName() : creator.getUsername()) : null);
        vo.setReadOnly(s.getSeedKey() != null);
        return vo;
    }

    private String toJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); } catch (Exception e) { return "{}"; }
    }
}
