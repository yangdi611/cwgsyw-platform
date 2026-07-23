package com.cwgsyw.platform.module.task.automation;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.task.automation.dto.TaskRelationVO;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/tasks/{taskId}/relations")
@RequiredArgsConstructor
public class TaskRelationController {
    private final TaskRelationService service;

    @GetMapping
    @PreAuthorize("hasAuthority('task:read')")
    public R<List<TaskRelationVO>> list(@PathVariable Long taskId, @AuthenticationPrincipal SecurityUser user) {
        return R.ok(service.list(user, taskId));
    }
}
