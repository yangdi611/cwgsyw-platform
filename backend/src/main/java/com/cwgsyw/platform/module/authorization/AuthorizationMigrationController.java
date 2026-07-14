package com.cwgsyw.platform.module.authorization;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationMigrationResult;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationPreflightReport;
import com.cwgsyw.platform.module.authorization.dto.ResourceMigrationRequest;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationMigrationExceptionVO;
import com.cwgsyw.platform.module.authorization.dto.ResolveMigrationExceptionRequest;
import com.cwgsyw.platform.module.authorization.dto.AssignMigrationGroupRequest;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationCutoverRequest;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationCutoverStatusVO;
import com.cwgsyw.platform.module.authorization.dto.PendingAuthorizationUserVO;
import com.cwgsyw.platform.module.authorization.dto.AuthorizationRelationshipCleanupResult;
import com.cwgsyw.platform.module.authorization.dto.CleanupMigrationExceptionRequest;
import com.cwgsyw.platform.module.authorization.dto.ConvertRoleAclRequest;
import com.cwgsyw.platform.module.authorization.dto.RoleAclConversionResult;
import com.cwgsyw.platform.common.PageResult;
import jakarta.validation.Valid;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rbac/migration")
@RequiredArgsConstructor
public class AuthorizationMigrationController {
    private final AuthorizationMigrationService migrationService;
    private final AuthorizationResourceMigrationService resourceMigrationService;
    private final AuthorizationMigrationExceptionService exceptionService;
    private final AuthorizationCutoverService cutoverService;

    @GetMapping("/preflight")
    @PreAuthorize("hasPermission('role', 'read')")
    public R<AuthorizationPreflightReport> preflight(@AuthenticationPrincipal SecurityUser currentUser) {
        requirePlatformAdministrator(currentUser);
        return R.ok(cutoverService.preflight(currentUser.getTenantId()));
    }

    @GetMapping("/cutover")
    @PreAuthorize("hasPermission('role', 'read')")
    public R<AuthorizationCutoverStatusVO> cutoverStatus(
            @AuthenticationPrincipal SecurityUser currentUser) {
        requirePlatformAdministrator(currentUser);
        return R.ok(cutoverService.status(currentUser.getTenantId()));
    }

    @PostMapping("/cutover/enforce")
    @PreAuthorize("hasPermission('role', 'assign')")
    public R<AuthorizationCutoverStatusVO> enforce(
            @Valid @RequestBody AuthorizationCutoverRequest request,
            @AuthenticationPrincipal SecurityUser currentUser) {
        requirePlatformAdministrator(currentUser);
        return R.ok(cutoverService.enforce(currentUser.getTenantId(), currentUser.getUserId(),
            currentUser.getGroupScope(), request.getConfirmation()));
    }

    @PostMapping("/cutover/rollback")
    @PreAuthorize("hasPermission('role', 'assign')")
    public R<AuthorizationCutoverStatusVO> rollback(
            @Valid @RequestBody AuthorizationCutoverRequest request,
            @AuthenticationPrincipal SecurityUser currentUser) {
        requirePlatformAdministrator(currentUser);
        return R.ok(cutoverService.rollback(currentUser.getTenantId(), currentUser.getUserId(),
            currentUser.getGroupScope(), request.getConfirmation()));
    }

    @GetMapping("/pending-users")
    @PreAuthorize("hasPermission('role', 'read')")
    public R<List<PendingAuthorizationUserVO>> pendingUsers(
            @AuthenticationPrincipal SecurityUser currentUser) {
        requirePlatformAdministrator(currentUser);
        return R.ok(cutoverService.pendingUsers(currentUser.getTenantId()));
    }

    @PutMapping("/pending-users/{userId}/primary-group")
    @PreAuthorize("hasPermission('role', 'assign')")
    public R<Void> assignPrimaryGroup(@PathVariable Long userId,
                                      @Valid @RequestBody AssignMigrationGroupRequest request,
                                      @AuthenticationPrincipal SecurityUser currentUser) {
        requirePlatformAdministrator(currentUser);
        cutoverService.assignPrimaryGroup(currentUser.getTenantId(), userId, request.getGroupId(),
            currentUser.getUserId(), currentUser.getGroupScope());
        return R.ok();
    }

    @PostMapping("/backfill")
    @PreAuthorize("hasPermission('role', 'assign')")
    public R<AuthorizationMigrationResult> backfill(@AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(migrationService.backfill(currentUser.getUserId(), currentUser.getGroupScope()));
    }

    @PostMapping("/resources/{module}/backfill")
    @PreAuthorize("hasPermission('role', 'assign')")
    public R<AuthorizationMigrationResult> backfillResources(
            @PathVariable String module, @Valid @RequestBody ResourceMigrationRequest request,
            @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(resourceMigrationService.backfill(currentUser.getTenantId(), module, request,
            currentUser.getUserId(), currentUser.getGroupScope()));
    }

    @GetMapping("/exceptions")
    @PreAuthorize("hasPermission('role', 'read')")
    public R<PageResult<AuthorizationMigrationExceptionVO>> listExceptions(
            @RequestParam(defaultValue = "open") String status,
            @RequestParam(required = false) String reasonCode,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser currentUser) {
        requirePlatformAdministrator(currentUser);
        return R.ok(exceptionService.list(currentUser.getTenantId(), status, reasonCode, keyword, page, size));
    }

    @PutMapping("/exceptions/{exceptionId}")
    @PreAuthorize("hasPermission('role', 'assign')")
    public R<Void> resolveException(@PathVariable Long exceptionId,
                                    @Valid @RequestBody ResolveMigrationExceptionRequest request,
                                    @AuthenticationPrincipal SecurityUser currentUser) {
        requirePlatformAdministrator(currentUser);
        exceptionService.resolve(exceptionId, currentUser.getTenantId(), request.getStatus(), request.getNote(),
            currentUser.getUserId());
        return R.ok();
    }

    @PostMapping("/exceptions/{exceptionId}/cleanup")
    @PreAuthorize("hasPermission('role', 'assign')")
    public R<AuthorizationRelationshipCleanupResult> cleanupException(
            @PathVariable Long exceptionId,
            @Valid @RequestBody CleanupMigrationExceptionRequest request,
            @AuthenticationPrincipal SecurityUser currentUser) {
        requirePlatformAdministrator(currentUser);
        return R.ok(exceptionService.cleanup(exceptionId, currentUser.getTenantId(), currentUser.getUserId()));
    }

    @PostMapping("/exceptions/{exceptionId}/convert-role-acl")
    @PreAuthorize("hasPermission('role', 'assign')")
    public R<RoleAclConversionResult> convertRoleAcl(
            @PathVariable Long exceptionId,
            @Valid @RequestBody ConvertRoleAclRequest request,
            @AuthenticationPrincipal SecurityUser currentUser) {
        requirePlatformAdministrator(currentUser);
        return R.ok(exceptionService.convertRoleAcl(exceptionId, currentUser.getTenantId(),
            request.getSubjectType(), request.getSubjectId(), currentUser.getUserId()));
    }

    private void requirePlatformAdministrator(SecurityUser currentUser) {
        if (!"platform".equals(currentUser.getGroupScope())) {
            throw new IllegalArgumentException("仅超级管理员可以执行授权迁移预检");
        }
    }

}
