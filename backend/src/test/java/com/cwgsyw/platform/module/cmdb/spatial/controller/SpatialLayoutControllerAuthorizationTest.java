package com.cwgsyw.platform.module.cmdb.spatial.controller;

import com.cwgsyw.platform.module.cmdb.spatial.dto.SpatialCreateLayoutRequest;
import com.cwgsyw.platform.module.cmdb.spatial.dto.SpatialPublishRequest;
import com.cwgsyw.platform.module.cmdb.spatial.dto.SpatialSaveDraftRequest;
import com.cwgsyw.platform.security.SecurityUser;
import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SpatialLayoutControllerAuthorizationTest {
    @Test
    void commandsAndDraftReadsRequireDedicatedSpatialPermissionsAndInstanceRead() throws Exception {
        assertGuard("create", new Class[]{SpatialCreateLayoutRequest.class, SecurityUser.class},
                "hasPermission('cmdb_spatial', 'create') and hasPermission('cmdb_instance', 'read')");
        assertGuard("draft", new Class[]{Long.class, SecurityUser.class},
                "hasPermission('cmdb_spatial', 'update') and hasPermission('cmdb_instance', 'read')");
        assertGuard("saveDraft", new Class[]{Long.class, SpatialSaveDraftRequest.class, SecurityUser.class},
                "hasPermission('cmdb_spatial', 'update') and hasPermission('cmdb_instance', 'read')");
        assertGuard("publish", new Class[]{Long.class, SpatialPublishRequest.class, SecurityUser.class},
                "hasPermission('cmdb_spatial', 'publish') and hasPermission('cmdb_instance', 'read')");
        assertGuard("archive", new Class[]{Long.class, SecurityUser.class},
                "hasPermission('cmdb_spatial', 'publish') and hasPermission('cmdb_instance', 'read')");
        assertGuard("restoreActive", new Class[]{Long.class, SecurityUser.class},
                "hasPermission('cmdb_spatial', 'publish') and hasPermission('cmdb_instance', 'read')");
        assertGuard("delete", new Class[]{Long.class, SecurityUser.class},
                "hasPermission('cmdb_spatial', 'delete') and hasPermission('cmdb_instance', 'read')");
    }

    private void assertGuard(String name, Class<?>[] types, String expected) throws Exception {
        Method method = SpatialLayoutController.class.getMethod(name, types);
        assertEquals(expected, method.getAnnotation(PreAuthorize.class).value());
    }
}
