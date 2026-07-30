package com.cwgsyw.platform.module.backup;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.backup.entity.BackupRecord;
import com.cwgsyw.platform.module.user.UserMapper;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class BackupServiceSecurityTest {

    @TempDir
    Path backupDir;

    private BackupMapper backupMapper;
    private AuditLogMapper auditLogMapper;
    private BackupService service;

    @BeforeEach
    void setUp() {
        backupMapper = mock(BackupMapper.class);
        auditLogMapper = mock(AuditLogMapper.class);
        service = new BackupService(
                backupMapper,
                auditLogMapper,
                mock(UserMapper.class),
                MinioClient.builder()
                        .endpoint("http://127.0.0.1:9000")
                        .credentials("test-access-key", "test-secret-key")
                        .build());
        ReflectionTestUtils.setField(service, "backupDir", backupDir.toString());
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "../outside.tar.gz",
            "subdir/outside.tar.gz",
            "..\\outside.tar.gz",
            "C:\\outside.tar.gz",
            "/tmp/outside.tar.gz",
            ".tar.gz\r\nX-Injected: value"
    })
    void importUploadRejectsPathComponentsAndControlCharacters(String originalName) {
        MockMultipartFile file = new MockMultipartFile(
                "file", originalName, "application/gzip", "archive".getBytes());

        assertThatThrownBy(() -> service.importUpload(file, 9L, "127.0.0.1", "default"))
                .isInstanceOf(IllegalArgumentException.class);

        verify(backupMapper, never()).insert(any(BackupRecord.class));
        verify(auditLogMapper, never()).insert(any(AuditLog.class));
    }

    @Test
    void importUploadUsesServerGeneratedStorageNameInsideBackupDirectory() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "daily-backup.tar.gz", "application/gzip", "archive".getBytes());

        var result = service.importUpload(file, 9L, "127.0.0.1", "default");

        assertThat(result.getFileName()).isEqualTo("daily-backup.tar.gz");
        try (var paths = Files.list(backupDir)) {
            var storedFiles = paths.toList();
            assertThat(storedFiles).hasSize(1);
            assertThat(storedFiles.getFirst().normalize().toAbsolutePath())
                    .startsWith(backupDir.normalize().toAbsolutePath());
            assertThat(storedFiles.getFirst().getFileName().toString())
                    .matches("[0-9a-f-]{36}\\.tar\\.gz");
            assertThat(Files.readString(storedFiles.getFirst())).isEqualTo("archive");
        }
        verify(backupMapper).insert(any(BackupRecord.class));
        verify(auditLogMapper).insert(any(AuditLog.class));
    }
}
