package com.cwgsyw.platform.module.wiki;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.rbac.SysRoleMapper;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import com.cwgsyw.platform.module.wiki.dto.*;
import com.cwgsyw.platform.module.wiki.entity.WikiPage;
import com.cwgsyw.platform.module.wiki.entity.WikiPageVersion;
import com.cwgsyw.platform.module.wiki.entity.WikiSpace;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

/**
 * 平台使用手册 seed 导入器。
 * 启动时（Flyway 迁移之后）读 classpath:wiki-manual/manifest.yaml + md 文件，
 * 幂等导入到「平台使用手册」空间：
 *   - 空间/页面用 seed_key 定位；页面内容 SHA-256 存 seed_hash，仅当 hash 变化才更新（覆盖式+保留 version 历史）
 *   - 仅对新建根页面设置只读 ACL（admin 可改、众人只读）
 * 详见 docs/guide/wiki（gitignore 仅保留此目录）与 CLAUDE.md。
 */
@Component
@Order(100)
@RequiredArgsConstructor
@Slf4j
public class WikiManualSeeder implements ApplicationRunner {

    private static final String MANIFEST = "wiki-manual/manifest.yaml";
    private static final String SEED_SPACE_KEY = "platform-manual";
    private static final String TENANT = "default";
    private static final Long SYSTEM_USER = 0L;

    private final WikiSpaceMapper spaceMapper;
    private final WikiPageMapper pageMapper;
    private final WikiPageVersionMapper versionMapper;
    private final WikiPageService pageService;
    private final WikiAclService aclService;
    private final WikiBacklinkService backlinkService;
    private final SysRoleMapper roleMapper;

    @Override
    @SuppressWarnings("unchecked")
    public void run(ApplicationArguments args) {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(MANIFEST)) {
            if (in == null) {
                log.info("[WikiManualSeeder] 未找到 {}，跳过", MANIFEST);
                return;
            }
            Map<String, Object> manifest = new Yaml().load(in);
            WikiSpace space = findOrCreateSpace((Map<String, Object>) manifest.get("space"));

            List<Map<String, Object>> pages = (List<Map<String, Object>>) manifest.get("pages");
            Map<String, Long> keyToId = new HashMap<>();
            List<Long> changedIds = new ArrayList<>();

            for (Map<String, Object> entry : pages) {
                upsertPage(space, entry, keyToId, changedIds);
            }
            // 二次遍历：所有页面已存在后再重建变更页的 backlinks（解析 [[标题]] 跨页引用）
            for (Long pid : changedIds) {
                WikiPage p = pageMapper.selectById(pid);
                if (p != null) backlinkService.rebuild(TENANT, pid, p.getContent());
            }
            log.info("[WikiManualSeeder] 完成：共 {} 页，{} 页有更新", pages.size(), changedIds.size());
        } catch (Exception e) {
            // seed 失败不应阻断应用启动，记录后继续
            log.error("[WikiManualSeeder] 导入失败：{}", e.getMessage(), e);
        }
    }

    // PLACEHOLDER_HELPERS

    /** 查 seed_key 对应空间，没有则建 */
    private WikiSpace findOrCreateSpace(Map<String, Object> spaceCfg) {
        WikiSpace existing = spaceMapper.selectOne(new LambdaQueryWrapper<WikiSpace>()
                .eq(WikiSpace::getTenantId, TENANT)
                .eq(WikiSpace::getSeedKey, SEED_SPACE_KEY)
                .last("LIMIT 1"));
        if (existing != null) return existing;

        WikiSpace s = new WikiSpace();
        s.setTenantId(TENANT);
        s.setName(str(spaceCfg.get("name"), "平台使用手册"));
        s.setDescription(str(spaceCfg.get("description"), ""));
        s.setSeedKey(SEED_SPACE_KEY);
        s.setCreatedBy(SYSTEM_USER);
        s.setCreatedAt(LocalDateTime.now());
        s.setUpdatedAt(LocalDateTime.now());
        spaceMapper.insert(s);
        log.info("[WikiManualSeeder] 创建手册空间 id={}", s.getId());
        return s;
    }

    /** 幂等 upsert 单页：新建 / hash 变化则更新 / 不变跳过。返回是否有改动。 */
    @SuppressWarnings("unchecked")
    private void upsertPage(WikiSpace space, Map<String, Object> entry,
                            Map<String, Long> keyToId, List<Long> changedIds) {
        String key = (String) entry.get("key");
        String title = str(entry.get("title"), key);
        String file = (String) entry.get("file");
        String parentKey = (String) entry.get("parent_key");
        int sort = entry.get("sort") instanceof Number n ? n.intValue() : 0;

        String content = loadMd(file);
        String hash = sha256(content);
        Long parentId = parentKey == null ? null : keyToId.get(parentKey);

        WikiPage existing = pageMapper.selectOne(new LambdaQueryWrapper<WikiPage>()
                .eq(WikiPage::getTenantId, TENANT)
                .eq(WikiPage::getSpaceId, space.getId())
                .eq(WikiPage::getSeedKey, key)
                .last("LIMIT 1"));

        if (existing == null) {
            WikiPage p = new WikiPage();
            p.setTenantId(TENANT);
            p.setSpaceId(space.getId());
            p.setParentId(parentId);
            p.setSlug(key.replace('/', '-'));
            p.setTitle(title);
            p.setContent(content);
            p.setStatus("published");              // seeder 静默发布，不走审批、不发通知
            p.setCurrentVersion(1);
            p.setSortOrder(sort);
            p.setAclInherited(parentId != null);   // 根页面自定义 ACL，子页面继承
            p.setSeedKey(key);
            p.setSeedHash(hash);
            p.setCreatedBy(SYSTEM_USER);
            p.setCreatedAt(LocalDateTime.now());
            p.setUpdatedAt(LocalDateTime.now());
            pageMapper.insert(p);
            insertVersion(p.getId(), 1, title, content, "seed 初始导入");
            keyToId.put(key, p.getId());
            changedIds.add(p.getId());
            if (parentId == null) applyReadOnlyAcl(p.getId());
            return;
        }

        keyToId.put(key, existing.getId());
        if (hash.equals(existing.getSeedHash())) return;   // 内容未变，跳过

        // hash 变化：保留旧版本快照 + 覆盖
        int newVer = existing.getCurrentVersion() + 1;
        existing.setTitle(title);
        existing.setContent(content);
        existing.setParentId(parentId);
        existing.setSortOrder(sort);
        existing.setCurrentVersion(newVer);
        existing.setStatus("published");
        existing.setSeedHash(hash);
        existing.setUpdatedBy(SYSTEM_USER);
        existing.setUpdatedAt(LocalDateTime.now());
        pageMapper.updateById(existing);
        insertVersion(existing.getId(), newVer, title, content, "seed 更新");
        changedIds.add(existing.getId());
    }

    private void insertVersion(Long pageId, int version, String title, String content, String comment) {
        WikiPageVersion v = new WikiPageVersion();
        v.setTenantId(TENANT);
        v.setPageId(pageId);
        v.setVersion(version);
        v.setTitle(title);
        v.setContent(content);
        v.setComment(comment);
        v.setCreatedBy(SYSTEM_USER);
        v.setCreatedAt(LocalDateTime.now());
        versionMapper.insert(v);
    }

    /** 根页面设只读 ACL：admin/super_admin 全权（实际靠 isAdmin 绕过），其余角色仅 read */
    private void applyReadOnlyAcl(Long pageId) {
        List<SysRole> roles = roleMapper.selectList(new LambdaQueryWrapper<>());
        List<AclEntryDTO> entries = new ArrayList<>();
        for (SysRole r : roles) {
            AclEntryDTO e = new AclEntryDTO();
            e.setSubjectType("role");
            e.setSubjectId(r.getId());
            boolean admin = "super_admin".equals(r.getCode()) || "admin".equals(r.getCode());
            e.setPermissions(admin ? List.of("read", "write", "delete", "publish") : List.of("read"));
            entries.add(e);
        }
        WikiAclDTO dto = new WikiAclDTO();
        dto.setPageId(pageId);
        dto.setInherited(false);
        dto.setEntries(entries);
        aclService.setAcl(TENANT, pageId, SYSTEM_USER, dto);
    }

    private String loadMd(String file) {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream("wiki-manual/" + file)) {
            if (in == null) {
                log.warn("[WikiManualSeeder] md 缺失: {}", file);
                return "";
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.warn("[WikiManualSeeder] md 读取失败 {}: {}", file, e.getMessage());
            return "";
        }
    }

    private static String sha256(String s) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return Integer.toHexString(s.hashCode());
        }
    }

    private static String str(Object o, String dft) {
        return o == null ? dft : o.toString();
    }
}
