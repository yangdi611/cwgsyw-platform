package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.rack.RackLayoutVO;
import com.cwgsyw.platform.module.cmdb.service.RackLayoutService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 2D 机柜视图接口（spec §5.2）。鉴权与实例 read 一致（§0.8）。
 */
@RestController
@RequestMapping("/api/cmdb/rack")
@RequiredArgsConstructor
public class RackController {

    private final RackLayoutService rackLayoutService;

    @GetMapping("/{rackInstanceId}/layout")
    @PreAuthorize("hasPermission('cmdb_instance', 'read')")
    public R<RackLayoutVO> layout(@PathVariable Long rackInstanceId,
                                  @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(rackLayoutService.getLayout(rackInstanceId, cu.getTenantId()));
    }
}
