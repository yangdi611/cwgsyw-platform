package com.cwgsyw.platform.security;

import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import java.io.Serializable;

@Component
public class CustomPermissionEvaluator implements PermissionEvaluator {

    @Override
    public boolean hasPermission(Authentication auth, Object targetDomainObject, Object permission) {
        if (auth == null || !(auth.getPrincipal() instanceof SecurityUser su)) return false;
        String permCode = targetDomainObject + ":" + permission;
        if (su.getPermissions().contains(permCode)) return true;
        return "cmdb_model:update".equals(permCode)
                && su.getPermissions().contains("cmdb_model:write");
    }

    @Override
    public boolean hasPermission(Authentication auth, Serializable targetId,
                                 String targetType, Object permission) {
        return hasPermission(auth, targetType, permission);
    }
}
