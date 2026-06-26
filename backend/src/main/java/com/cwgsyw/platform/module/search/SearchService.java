package com.cwgsyw.platform.module.search;

import com.cwgsyw.platform.module.changedoc.ChangeDocService;
import com.cwgsyw.platform.module.changedoc.dto.ChangeDocVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.CiInstanceSearchVO;
import com.cwgsyw.platform.module.cmdb.service.CiInstanceQueryService;
import com.cwgsyw.platform.module.device.DeviceService;
import com.cwgsyw.platform.module.device.dto.DeviceVO;
import com.cwgsyw.platform.module.sharedfile.SharedFileService;
import com.cwgsyw.platform.module.sharedfile.dto.SharedFileVO;
import com.cwgsyw.platform.module.user.UserService;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.module.wiki.WikiPageService;
import com.cwgsyw.platform.module.wiki.dto.WikiSearchResultVO;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/**
 * 统一全局搜索（⌘K 命令面板后端）。
 *
 * <p>聚合六类资源：CI 实例、共享文件、变更单、设备、用户、知识库页面。
 * <strong>按权限收敛</strong>：逐类检查调用者是否持有对应 {@code resource:read}
 * 权限，无权的类型直接跳过——结果天然不泄漏越权数据。各底层 service 自身还会
 * 做组级越权 / ACL / 组可见性过滤（设备、共享文件），本层只负责聚合与归一。
 *
 * <p>流程实例（Flowable）刻意不纳入搜索范围。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SearchService {

    private final CiInstanceQueryService ciInstanceQueryService;
    private final SharedFileService sharedFileService;
    private final ChangeDocService changeDocService;
    private final DeviceService deviceService;
    private final UserService userService;
    private final WikiPageService wikiPageService;

    /**
     * 执行聚合搜索。每类最多返回 {@code perType} 条。任一类型查询抛错只记录日志、
     * 不影响其余类型（搜索是尽力而为的只读聚合）。
     *
     * @param keyword 关键词（空白直接返回空列表）
     * @param perType 每类返回上限
     * @param u       当前登录用户（用于权限收敛 + 组级过滤）
     */
    public List<SearchResultVO> search(String keyword, int perType, SecurityUser u) {
        List<SearchResultVO> results = new ArrayList<>();
        if (!StringUtils.hasText(keyword)) return results;
        String kw = keyword.trim();
        String tenantId = u.getTenantId();

        // ── CI 实例 ──────────────────────────────────────────────
        if (has(u, "cmdb_instance:read")) {
            safe("ci", () -> {
                List<CiInstanceSearchVO> hits =
                    ciInstanceQueryService.search(kw, perType, tenantId).getRecords();
                for (CiInstanceSearchVO ci : hits) {
                    results.add(new SearchResultVO(
                        "ci", ci.getId(), ci.getName(),
                        ci.getSnippet() != null ? ci.getSnippet() : ci.getModelName(),
                        "/cmdb/instances/by-model/" + ci.getModelId() + "/" + ci.getId(),
                        "配置项 (CI)"));
                }
            });
        }

        // ── 共享文件 ─────────────────────────────────────────────
        if (has(u, "shared_file:read")) {
            safe("shared_file", () -> {
                List<SharedFileVO> hits = sharedFileService.listFiles(
                    tenantId, null, kw, u.getUserId(), u.getGroupId(),
                    u.getGroupScope(), 1, perType).getRecords();
                for (SharedFileVO f : hits) {
                    results.add(new SearchResultVO(
                        "shared_file", f.getId(),
                        f.getOriginalName() != null ? f.getOriginalName() : f.getName(),
                        f.getFileType(),
                        "/files/preview/" + f.getId(),
                        "共享文件"));
                }
            });
        }

        // ── 变更单 ───────────────────────────────────────────────
        if (has(u, "change_doc:read")) {
            safe("change_doc", () -> {
                List<ChangeDocVO> hits = changeDocService.searchByTitle(tenantId, kw, perType);
                for (ChangeDocVO d : hits) {
                    results.add(new SearchResultVO(
                        "change_doc", d.getId(), d.getTitle(),
                        d.getChangeNo(),
                        "/change-docs/" + d.getId(),
                        "变更单"));
                }
            });
        }

        // ── 设备 ─────────────────────────────────────────────────
        if (has(u, "device:read")) {
            safe("device", () -> {
                List<DeviceVO> hits = deviceService.searchByKeyword(
                    kw, perType, tenantId, u.getGroupId(), u.getGroupScope());
                for (DeviceVO d : hits) {
                    results.add(new SearchResultVO(
                        "device", d.getId(), d.getName(),
                        d.getIp(),
                        "/devices/" + d.getId(),
                        "设备"));
                }
            });
        }

        // ── 用户 ─────────────────────────────────────────────────
        if (has(u, "user:read")) {
            safe("user", () -> {
                List<User> hits = userService.searchByName(kw, perType, tenantId);
                for (User user : hits) {
                    results.add(new SearchResultVO(
                        "user", user.getId(),
                        user.getRealName() != null ? user.getRealName() : user.getUsername(),
                        user.getUsername(),
                        "/users",
                        "用户"));
                }
            });
        }

        // ── 知识库 ───────────────────────────────────────────────
        if (has(u, "wiki:read")) {
            safe("wiki", () -> {
                List<WikiSearchResultVO> hits =
                    wikiPageService.search(tenantId, kw, null, 1, perType).getRecords();
                for (WikiSearchResultVO w : hits) {
                    results.add(new SearchResultVO(
                        "wiki", w.getPageId(), w.getTitle(),
                        w.getHighlight(),
                        "/wiki/" + w.getSpaceId() + "/" + w.getPageId(),
                        "知识库"));
                }
            });
        }

        return results;
    }

    private boolean has(SecurityUser u, String permission) {
        return u.getPermissions() != null && u.getPermissions().contains(permission);
    }

    /** 单类查询失败不影响整体聚合，仅记录日志。 */
    private void safe(String type, Runnable task) {
        try {
            task.run();
        } catch (Exception e) {
            log.warn("[search] type={} 查询失败: {}", type, e.getMessage());
        }
    }
}
