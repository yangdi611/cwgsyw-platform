package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.wiki.dto.WikiBacklinkVO;
import com.cwgsyw.platform.module.wiki.entity.WikiBacklink;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class WikiBacklinkService {

    private static final Pattern LINK_PATTERN = Pattern.compile("\\[\\[([^\\]|]+)(?:\\|[^\\]]*)?\\]\\]");

    private final WikiBacklinkMapper backlinkMapper;
    private final WikiPageMapper pageMapper;

    /** 删除 fromPageId 全部出链，解析 [[links]] 重建 */
    @Transactional
    public void rebuild(String tenantId, Long fromPageId, String content) {
        backlinkMapper.delete(new LambdaQueryWrapper<WikiBacklink>()
                .eq(WikiBacklink::getFromPageId, fromPageId));
        if (content == null || content.isBlank()) return;

        Matcher m = LINK_PATTERN.matcher(content);
        java.util.Set<Long> seen = new java.util.HashSet<>();
        while (m.find()) {
            String title = m.group(1).trim();
            if (title.isEmpty()) continue;
            WikiPage target = pageMapper.selectOne(new LambdaQueryWrapper<WikiPage>()
                    .eq(WikiPage::getTenantId, tenantId)
                    .eq(WikiPage::getTitle, title)
                    .last("LIMIT 1"));
            if (target == null) continue;
            if (!seen.add(target.getId())) continue;
            WikiBacklink bl = new WikiBacklink();
            bl.setTenantId(tenantId);
            bl.setFromPageId(fromPageId);
            bl.setToPageId(target.getId());
            bl.setCreatedAt(LocalDateTime.now());
            backlinkMapper.insert(bl);
        }
    }

    public List<WikiBacklinkVO> getBacklinks(String tenantId, Long toPageId) {
        List<WikiBacklink> links = backlinkMapper.selectList(new LambdaQueryWrapper<WikiBacklink>()
                .eq(WikiBacklink::getTenantId, tenantId)
                .eq(WikiBacklink::getToPageId, toPageId));
        List<WikiBacklinkVO> result = new ArrayList<>();
        for (WikiBacklink bl : links) {
            WikiPage from = pageMapper.selectById(bl.getFromPageId());
            if (from == null) continue;
            WikiBacklinkVO vo = new WikiBacklinkVO();
            vo.setPageId(from.getId());
            vo.setTitle(from.getTitle());
            vo.setSpaceId(from.getSpaceId());
            result.add(vo);
        }
        return result;
    }
}
