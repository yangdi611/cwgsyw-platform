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
 * Wiki seed 导入器。启动时（Flyway 迁移之后）读 classpath:wiki-manual/manifest.yaml + md 文件，
 * 幂等导入多个系统空间（平台使用手册 / Release Notes / Bug 反馈）：
 *   - 空间/页面用 seed_key 定位；页面内容 SHA-256 存 seed_hash，仅当 hash 变化才更新（覆盖式+保留 version 历史）
 *   - 每个空间有 write_scope，决定根页面 ACL：all=所有人可读/建/写/发布(delete 仅 admin)；
 *     none/super_admin_only=锁定，任何人（含 admin）都不可写，只能评论
 *   - 单页可标 read_only: true 强制只读（如 Bug 反馈空间的模板页）
 * 详见 docs/guide/wiki 与 CLAUDE.md。
 */
@Component
@Order(100)
@RequiredArgsConstructor
@Slf4j
public class WikiManualSeeder implements ApplicationRunner {

    private static final String MANIFEST = "wiki-manual/manifest.yaml";
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
                log.info("[WikiSeeder] 未找到 {}，跳过", MANIFEST);
                return;
            }
            Map<String, Object> manifest = new Yaml().load(in);
            List<Map<String, Object>> spaces = (List<Map<String, Object>>) manifest.get("spaces");
            if (spaces == null) {
                log.warn("[WikiSeeder] manifest 缺少 spaces，跳过");
                return;
            }
            int totalPages = 0, totalChanged = 0;
            for (Map<String, Object> spaceCfg : spaces) {
                WikiSpace space = findOrCreateSpace(spaceCfg);
                List<Map<String, Object>> pages = (List<Map<String, Object>>) spaceCfg.get("pages");
                if (pages == null) continue;
                String writeScope = str(spaceCfg.get("write_scope"), "none");
                Map<String, Long> keyToId = new HashMap<>();
                List<Long> changedIds = new ArrayList<>();
                for (Map<String, Object> entry : pages) {
                    upsertPage(space, writeScope, entry, keyToId, changedIds);
                }
                // 二次遍历：所有页面已存在后再重建变更页的 backlinks（解析 [[标题]] 跨页引用）
                for (Long pid : changedIds) {
                    WikiPage p = pageMapper.selectById(pid);
                    if (p != null) backlinkService.rebuild(TENANT, pid, p.getContent());
                }
                totalPages += pages.size();
                totalChanged += changedIds.size();
                log.info("[WikiSeeder] 空间「{}」: {} 页，{} 页有更新", space.getName(), pages.size(), changedIds.size());
            }
            log.info("[WikiSeeder] 完成：{} 个空间，共 {} 页，{} 页有更新", spaces.size(), totalPages, totalChanged);
        } catch (Exception e) {
            // seed 失败不应阻断应用启动，记录后继续
            log.error("[WikiSeeder] 导入失败：{}", e.getMessage(), e);
        }
    }

    // PLACEHOLDER_HELPERS

    /** 按 seed_key 查找或创建空间（泛化：不再硬编码 SEED_SPACE_KEY） */
    private WikiSpace findOrCreateSpace(Map<String, Object> spaceCfg) {
        String key = str(spaceCfg.get("key"), "");
        String writeScope = str(spaceCfg.get("write_scope"), "none");
        WikiSpace existing = spaceMapper.selectOne(new LambdaQueryWrapper<WikiSpace>()
                .eq(WikiSpace::getTenantId, TENANT)
                .eq(WikiSpace::getSeedKey, key)
                .last("LIMIT 1"));
        if (existing != null) {
            // 确保 write_scope 是最新值（允许 manifest 修改策略后生效）
            if (!writeScope.equals(existing.getWriteScope())) {
                existing.setWriteScope(writeScope);
                spaceMapper.updateById(existing);
            }
            return existing;
        }
        WikiSpace s = new WikiSpace();
        s.setTenantId(TENANT);
        s.setName(str(spaceCfg.get("name"), key));
        s.setDescription(str(spaceCfg.get("description"), ""));
        s.setSeedKey(key);
        s.setWriteScope(writeScope);
        s.setCreatedBy(SYSTEM_USER);
        s.setCreatedAt(LocalDateTime.now());
        s.setUpdatedAt(LocalDateTime.now());
        spaceMapper.insert(s);
        log.info("[WikiSeeder] 创建空间「{}」id={}", s.getName(), s.getId());
        return s;
    }

    /** 幂等 upsert 单页：新建 / hash 变化则更新 / 不变跳过。 */
    @SuppressWarnings("unchecked")
    private void upsertPage(WikiSpace space, String writeScope, Map<String, Object> entry,
                            Map<String, Long> keyToId, List<Long> changedIds) {
        String key = (String) entry.get("key");
        String title = str(entry.get("title"), key);
        String file = (String) entry.get("file");
        String parentKey = (String) entry.get("parent_key");
        int sort = entry.get("sort") instanceof Number n ? n.intValue() : 0;
        boolean pageReadOnly = Boolean.TRUE.equals(entry.get("read_only"));

        String content = loadMd(file);
        String hash = sha256(content);
        Long parentId = parentKey == null ? null : keyToId.get(parentKey);
        // 是否需要自定义 ACL：根页面按 write_scope，或单页强制只读
        boolean customAcl = (parentId == null) || pageReadOnly;

        WikiPage existing = pageMapper.selectOne(new LambdaQueryWrapper<WikiPage>()
                .eq(WikiPage::getTenantId, TENANT)
                .eq(WikiPage::getSpaceId, space.getId())
                .eq(WikiPage::getSeedKey, key)
                .last("LIMIT 1"));

        Long pageId;
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
            p.setAclInherited(!customAcl);         // 自定义 ACL 的页面不继承
            p.setSeedKey(key);
            p.setSeedHash(hash);
            p.setCreatedBy(SYSTEM_USER);
            p.setCreatedAt(LocalDateTime.now());
            p.setUpdatedAt(LocalDateTime.now());
            pageMapper.insert(p);
            insertVersion(p.getId(), 1, title, content, "seed 初始导入");
            keyToId.put(key, p.getId());
            changedIds.add(p.getId());
            pageId = p.getId();
        } else {
            keyToId.put(key, existing.getId());
            pageId = existing.getId();
            if (!hash.equals(existing.getSeedHash())) {
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
            if (!Objects.equals(existing.getAclInherited(), !customAcl)) {
                existing.setAclInherited(!customAcl);
                pageMapper.updateById(existing);
            }
        }
        // 每次启动都重新校准 ACL（不只在首次创建时）——否则线上已存在的系统页面在 manifest
        // 调整 write_scope/read_only 策略后不会跟着变，2026-07-06 修复
        if (customAcl) applyAcl(pageId, pageReadOnly ? "none" : writeScope);
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

    /**
     * 按 write_scope 设置页面 ACL（acl_inherited=false）。
     * 注意权限动词以 WikiAclService.ALL_PERMS 为准：read/write/delete/publish（编辑用 write，无 update）。
     * 这里只授予 read/write/publish，绝不授予 delete——delete 完全交给
     * WikiSpaceService.hasWritePermission 的 isAdmin 分支单独把关（仅 admin/super_admin），
     * 若在这里也授予 delete 会被 WikiAclService.hasExplicitPermission 的页面级 ACL 直接放行，
     * 绕过"delete 仅管理员"的限制。
     *   all              → 所有角色 read/write/publish（不含 delete）
     *   none/super_admin_only → 锁定：所有角色（含 admin/super_admin）仅 read，只能评论
     */
    private void applyAcl(Long pageId, String writeScope) {
        List<SysRole> roles = roleMapper.selectList(new LambdaQueryWrapper<>());
        List<AclEntryDTO> entries = new ArrayList<>();
        for (SysRole r : roles) {
            AclEntryDTO e = new AclEntryDTO();
            e.setSubjectType("role");
            e.setSubjectId(r.getId());
            e.setPermissions(permsFor(writeScope));
            entries.add(e);
        }
        WikiAclDTO dto = new WikiAclDTO();
        dto.setPageId(pageId);
        dto.setInherited(false);
        dto.setEntries(entries);
        aclService.setAcl(TENANT, pageId, SYSTEM_USER, dto);
    }

    private List<String> permsFor(String writeScope) {
        return "all".equals(writeScope)
                ? List.of("read", "write", "publish")
                : List.of("read");
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
