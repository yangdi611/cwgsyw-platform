package com.cwgsyw.platform.module.calendar;

import com.cwgsyw.platform.module.opscalendar.OpsCalendarHolidayController;
import com.cwgsyw.platform.module.opscalendar.OpsCalendarRosterController;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RequestMapping;

import java.lang.reflect.Method;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class CalendarControllerContractTest {

    @Test
    void calendarReadModelUsesTheFormalPathAndTaskReadPermission() {
        assertThat(path(CalendarQueryController.class)).containsExactly("/api/calendar");
        assertPermissions(CalendarQueryController.class, "hasAuthority('task:read')");
    }

    @Test
    void calendarSettingsUseOnlyTheFormalPathsAndSettingsPermissions() {
        assertThat(path(OpsCalendarRosterController.class)).containsExactly("/api/calendar-settings/rosters");
        assertThat(path(OpsCalendarHolidayController.class)).containsExactly("/api/calendar-settings/holidays");

        assertThat(permission(OpsCalendarRosterController.class, "list"))
            .isEqualTo("hasAuthority('calendar_settings:read')");
        assertThat(permission(OpsCalendarHolidayController.class, "list"))
            .isEqualTo("hasAuthority('calendar_settings:read')");
        Arrays.stream(OpsCalendarRosterController.class.getDeclaredMethods())
            .filter(method -> !"list".equals(method.getName()))
            .forEach(method -> assertThat(permission(method)).isEqualTo("hasAuthority('calendar_settings:manage')"));
        Arrays.stream(OpsCalendarHolidayController.class.getDeclaredMethods())
            .filter(method -> !"list".equals(method.getName()))
            .forEach(method -> assertThat(permission(method)).isEqualTo("hasAuthority('calendar_settings:manage')"));
    }

    private String[] path(Class<?> controller) {
        return controller.getAnnotation(RequestMapping.class).value();
    }

    private void assertPermissions(Class<?> controller, String expression) {
        Arrays.stream(controller.getDeclaredMethods())
            .forEach(method -> assertThat(permission(method)).isEqualTo(expression));
    }

    private String permission(Class<?> controller, String methodName) {
        return Arrays.stream(controller.getDeclaredMethods())
            .filter(method -> methodName.equals(method.getName()))
            .findFirst().map(this::permission).orElse(null);
    }

    private String permission(Method method) {
        PreAuthorize annotation = method.getAnnotation(PreAuthorize.class);
        return annotation == null ? null : annotation.value();
    }
}
