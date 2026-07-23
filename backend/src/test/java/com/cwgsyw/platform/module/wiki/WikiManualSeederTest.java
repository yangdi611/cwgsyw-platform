package com.cwgsyw.platform.module.wiki;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class WikiManualSeederTest {

    @Test
    void systemResourcesUseSpecDefaultsWithoutWorldWritableMode() {
        assertEquals(0755, WikiManualSeeder.systemSpacePermissionMode("none"));
        assertEquals(0755, WikiManualSeeder.systemSpacePermissionMode("super_admin_only"));
        assertEquals(0755, WikiManualSeeder.systemSpacePermissionMode("all"));

        assertEquals(0645, WikiManualSeeder.systemPagePermissionMode("none", false));
        assertEquals(0645, WikiManualSeeder.systemPagePermissionMode("all", false));
        assertEquals(0645, WikiManualSeeder.systemPagePermissionMode("all", true));
    }
}
