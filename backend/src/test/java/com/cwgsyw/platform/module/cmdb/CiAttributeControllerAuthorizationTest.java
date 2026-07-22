package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.module.cmdb.controller.CiAttributeController;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CreateAttributeRequest;
import com.cwgsyw.platform.module.cmdb.dto.attribute.UpdateAttributeRequest;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import static org.assertj.core.api.Assertions.assertThat;

class CiAttributeControllerAuthorizationTest {

    @Test
    void attributeEndpointsUseCanonicalActionGuards() throws NoSuchMethodException {
        assertGuard("list", "hasPermission('cmdb_attribute', 'read')", String.class, SecurityUser.class);
        assertGuard("create", "hasPermission('cmdb_attribute', 'create')", String.class,
                CreateAttributeRequest.class, SecurityUser.class);
        assertGuard("update", "hasPermission('cmdb_attribute', 'update')", String.class, Long.class,
                UpdateAttributeRequest.class, SecurityUser.class);
        assertGuard("delete", "hasPermission('cmdb_attribute', 'delete')", String.class, Long.class,
                SecurityUser.class);
    }

    private void assertGuard(String methodName, String expected, Class<?>... parameterTypes)
            throws NoSuchMethodException {
        PreAuthorize guard = CiAttributeController.class.getMethod(methodName, parameterTypes)
                .getAnnotation(PreAuthorize.class);
        assertThat(guard).isNotNull();
        assertThat(guard.value()).isEqualTo(expected);
    }
}
