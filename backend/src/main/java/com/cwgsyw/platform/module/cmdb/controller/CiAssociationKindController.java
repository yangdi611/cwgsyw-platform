package com.cwgsyw.platform.module.cmdb.controller;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.cmdb.dto.association.CiAssociationKindVO;
import com.cwgsyw.platform.module.cmdb.service.CiAssociationKindService;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/cmdb/association-kinds")
@RequiredArgsConstructor
public class CiAssociationKindController {

    private final CiAssociationKindService ciAssociationKindService;

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_relation', 'read')")
    public R<List<CiAssociationKindVO>> list(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(ciAssociationKindService.list(cu.getTenantId()));
    }
}
