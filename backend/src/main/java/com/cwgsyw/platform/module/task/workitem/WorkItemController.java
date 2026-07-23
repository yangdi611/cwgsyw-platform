package com.cwgsyw.platform.module.task.workitem;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.task.workitem.dto.WorkItemCountsVO;
import com.cwgsyw.platform.module.task.workitem.dto.WorkItemVO;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/work-items")
@RequiredArgsConstructor
public class WorkItemController {
    private final WorkItemService service;

    @GetMapping
    @PreAuthorize("hasAuthority('work_item:read')")
    public R<PageResult<WorkItemVO>> list(
            @RequestParam(defaultValue = "execute") String tab,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long templateId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Boolean overdue,
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {
        return R.ok(service.list(user, tab, keyword, templateId, status, priority, overdue,
            groupId, from, to, page, size));
    }

    @GetMapping("/counts")
    @PreAuthorize("hasAuthority('work_item:read')")
    public R<WorkItemCountsVO> counts(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(service.counts(user));
    }
}
