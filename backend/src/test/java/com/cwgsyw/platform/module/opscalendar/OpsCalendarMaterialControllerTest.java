package com.cwgsyw.platform.module.opscalendar;

import com.cwgsyw.platform.module.opscalendar.service.OpsCalendarMaterialService;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Set;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class OpsCalendarMaterialControllerTest {
    private final OpsCalendarMaterialService service = mock(OpsCalendarMaterialService.class);
    private final OpsCalendarMaterialController controller = new OpsCalendarMaterialController(service);
    private final LocalDate startDate = LocalDate.of(2099, 11, 1);
    private final LocalDate endDate = LocalDate.of(2099, 11, 30);

    @Test
    void collect_forcesAuthenticatedGroupScope() {
        SecurityUser user = user("group", 2L);

        controller.collect("quarter", startDate, endDate, 3L, user);

        verify(service).collect("default", "quarter", startDate, endDate, 2L);
    }

    @Test
    void export_forcesAuthenticatedGroupScope() {
        SecurityUser user = user("group", 2L);

        controller.export("quarter", startDate, endDate, 3L, user);

        verify(service).exportExcel("default", "quarter", startDate, endDate, 2L);
    }

    @Test
    void collect_preservesTenantGroupSelection() {
        SecurityUser user = user("tenant", 2L);

        controller.collect("quarter", startDate, endDate, 3L, user);

        verify(service).collect("default", "quarter", startDate, endDate, 3L);
    }

    @Test
    void export_preservesPlatformTenantWideSelection() {
        SecurityUser user = user("platform", null);

        controller.export("quarter", startDate, endDate, null, user);

        verify(service).exportExcel("default", "quarter", startDate, endDate, null);
    }

    private SecurityUser user(String groupScope, Long groupId) {
        return new SecurityUser(1L, "operator", "", "default", groupId, groupScope,
                Set.of("ops_calendar:export"));
    }
}
