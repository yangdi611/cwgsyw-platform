package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.module.cmdb.controller.CiTopologyController;
import com.cwgsyw.platform.module.cmdb.controller.CsvImportController;
import com.cwgsyw.platform.module.cmdb.controller.ImpactAnalysisController;
import com.cwgsyw.platform.module.cmdb.controller.JsonImportController;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvImportExecuteRequest;
import com.cwgsyw.platform.module.cmdb.dto.impact.ImpactAnalysisRequest;
import com.cwgsyw.platform.security.SecurityUser;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.multipart.MultipartFile;

import static org.assertj.core.api.Assertions.assertThat;

class CmdbCanonicalPermissionConsumerAuthorizationTest {

    @Test
    void importEndpointsUseCanonicalReadAndExecuteActions() throws NoSuchMethodException {
        assertGuard(CsvImportController.class, "downloadTemplate", "hasPermission('cmdb_import', 'read')",
                String.class, SecurityUser.class);
        assertGuard(CsvImportController.class, "preview", "hasPermission('cmdb_import', 'execute')",
                MultipartFile.class, String.class, String.class, String.class, String.class, SecurityUser.class);
        assertGuard(CsvImportController.class, "execute", "hasPermission('cmdb_import', 'execute')",
                CsvImportExecuteRequest.class, SecurityUser.class);
        assertGuard(CsvImportController.class, "getProgress", "hasPermission('cmdb_import', 'read')",
                String.class, SecurityUser.class);
        assertGuard(CsvImportController.class, "downloadFailedRows", "hasPermission('cmdb_import', 'read')",
                String.class, SecurityUser.class);
        assertGuard(JsonImportController.class, "preview", "hasPermission('cmdb_import', 'execute')",
                MultipartFile.class, String.class, String.class, String.class, SecurityUser.class);
        assertGuard(JsonImportController.class, "previewRaw", "hasPermission('cmdb_import', 'execute')",
                String.class, String.class, String.class, String.class, SecurityUser.class);
        assertGuard(JsonImportController.class, "execute", "hasPermission('cmdb_import', 'execute')",
                CsvImportExecuteRequest.class, SecurityUser.class);
    }

    @Test
    void impactAndTopologyRequireCanonicalActionAndInstanceRead() throws NoSuchMethodException {
        assertGuard(ImpactAnalysisController.class, "analyze",
                "hasPermission('cmdb_impact', 'read') and hasPermission('cmdb_instance', 'read')",
                Long.class, ImpactAnalysisRequest.class, SecurityUser.class);
        assertGuard(CiTopologyController.class, "getTopology",
                "hasPermission('cmdb_topology', 'read') and hasPermission('cmdb_instance', 'read')",
                Long.class, int.class, SecurityUser.class);
        assertGuard(CiTopologyController.class, "compare",
                "hasPermission('cmdb_topology', 'read') and hasPermission('cmdb_instance', 'read')",
                Long.class, String.class, String.class, int.class, SecurityUser.class);
    }

    private void assertGuard(Class<?> controller, String methodName, String expected,
                             Class<?>... parameterTypes) throws NoSuchMethodException {
        PreAuthorize guard = controller.getMethod(methodName, parameterTypes).getAnnotation(PreAuthorize.class);
        assertThat(guard).isNotNull();
        assertThat(guard.value()).isEqualTo(expected);
    }
}
