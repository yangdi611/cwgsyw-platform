package com.cwgsyw.platform.module.workflow.template;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.workflow.template.dto.CreateTemplateInstanceRequest;
import com.cwgsyw.platform.module.workflow.template.dto.TemplateInstanceVO;
import com.cwgsyw.platform.module.workflow.template.model.TemplateDefinition;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 流程模板管理 API。复用 {@code workflow:configure} 权限（见 V62 迁移说明）。
 */
@RestController
@RequestMapping("/api/workflow/templates")
@RequiredArgsConstructor
public class WorkflowTemplateController {

    private final WorkflowTemplateService templateService;

    /** 列出内置模板定义（含配置 schema，供前端渲染表单）。 */
    @GetMapping
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<List<TemplateDefinition>> listTemplates() {
        return R.ok(templateService.listTemplates());
    }

    /** 列出当前租户的模板实例。 */
    @GetMapping("/instances")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<List<TemplateInstanceVO>> listInstances(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(templateService.listInstances(cu.getTenantId()));
    }

    /** 基于模板创建实例（生成 BPMN + 部署 + 落库 + 可选绑定）。 */
    @PostMapping("/instances")
    @PreAuthorize("hasPermission('workflow', 'configure')")
    public R<TemplateInstanceVO> createInstance(@RequestBody CreateTemplateInstanceRequest req,
                                                @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(templateService.createInstance(cu.getTenantId(), cu.getUserId(), req));
    }
}
