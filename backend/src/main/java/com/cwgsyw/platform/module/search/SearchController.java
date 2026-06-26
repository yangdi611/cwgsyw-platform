package com.cwgsyw.platform.module.search;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 统一全局搜索端点（⌘K 命令面板）。
 *
 * <p>无需独立权限——RBAC 收敛发生在 {@link SearchService} 内部：逐类检查
 * {@code resource:read} 权限，仅返回当前用户有权查看的类型。任何已登录用户
 * 都可调用，结果天然按其权限收敛。
 */
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
@Validated
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public R<List<SearchResultVO>> search(
            @RequestParam @NotBlank String keyword,
            @RequestParam(defaultValue = "5") int size,
            @AuthenticationPrincipal SecurityUser u) {
        // size 夹取到 [1, 20]，防止恶意放大单类返回量
        int perType = Math.max(1, Math.min(size, 20));
        return R.ok(searchService.search(keyword, perType, u));
    }
}
