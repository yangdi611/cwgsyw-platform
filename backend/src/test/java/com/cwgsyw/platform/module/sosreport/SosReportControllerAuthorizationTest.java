package com.cwgsyw.platform.module.sosreport;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class SosReportControllerAuthorizationTest {

    private static final Map<String, String> EXPECTED = Map.ofEntries(
        Map.entry("upload", "upload"),
        Map.entry("startUpload", "upload"),
        Map.entry("uploadChunk", "upload"),
        Map.entry("completeUpload", "upload"),
        Map.entry("cancelUpload", "upload"),
        Map.entry("list", "read"),
        Map.entry("detail", "read"),
        Map.entry("delete", "delete"),
        Map.entry("factCatalog", "read"),
        Map.entry("mappings", "read"),
        Map.entry("saveMapping", "manage_mapping"),
        Map.entry("removeMapping", "manage_mapping"),
        Map.entry("suggest", "manage_mapping"),
        Map.entry("preview", "read"),
        Map.entry("submit", "submit"),
        Map.entry("requests", "read"),
        Map.entry("approvals", "approve"),
        Map.entry("decide", "approve"));

    private static List<Method> endpoints() {
        return Arrays.stream(SosReportController.class.getDeclaredMethods())
            .filter(method -> method.isAnnotationPresent(GetMapping.class) || method.isAnnotationPresent(PostMapping.class)
                || method.isAnnotationPresent(PutMapping.class) || method.isAnnotationPresent(DeleteMapping.class))
            .toList();
    }

    @Test
    void everyEndpointIsGuardedByTheExpectedPermission() {
        List<Method> endpoints = endpoints();
        assertEquals(EXPECTED.keySet(), endpoints.stream().map(Method::getName).collect(Collectors.toSet()),
            "新增接口要在这里声明权限");
        for (Method method : endpoints) {
            PreAuthorize guard = method.getAnnotation(PreAuthorize.class);
            assertNotNull(guard, method.getName());
            assertEquals("hasAuthority('sos_report:" + EXPECTED.get(method.getName()) + "')", guard.value(), method.getName());
        }
    }
}
