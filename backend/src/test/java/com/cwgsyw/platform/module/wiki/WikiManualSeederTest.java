package com.cwgsyw.platform.module.wiki;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WikiManualSeederTest {

    @Test
    void strictCutoverLifecycleDoesNotCreateNewLegacyRoleAcl() {
        assertFalse(WikiManualSeeder.writesLegacyAcl("enforced"));
        assertFalse(WikiManualSeeder.writesLegacyAcl("preparing"));
        assertFalse(WikiManualSeeder.writesLegacyAcl("frozen"));
        assertTrue(WikiManualSeeder.writesLegacyAcl("rollback"));
    }

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
