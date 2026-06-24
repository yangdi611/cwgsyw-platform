package com.cwgsyw.platform.module.backup;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.backup.dto.BackupRecordVO;
import com.cwgsyw.platform.module.backup.entity.BackupRecord;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api/backups")
@RequiredArgsConstructor
public class BackupController {

    private final BackupService backupService;

    @GetMapping
    @PreAuthorize("hasAuthority('backup:read')")
    public R<PageResult<BackupRecordVO>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(backupService.list(page, size, cu.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('backup:create')")
    public R<BackupRecordVO> create(@AuthenticationPrincipal SecurityUser cu, HttpServletRequest req) {
        BackupRecord record = backupService.createBackup(cu.getUserId(), clientIp(req), cu.getTenantId());
        return backupService.list(1, 1, cu.getTenantId()).getRecords().stream()
                .filter(v -> v.getId().equals(record.getId()))
                .findFirst()
                .map(R::ok)
                .orElse(R.ok(null));
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("hasAuthority('backup:read')")
    public ResponseEntity<Resource> download(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu) {
        BackupRecord record = backupService.findOrThrow(id, cu.getTenantId());
        if (record.getFilePath() == null) {
            return ResponseEntity.notFound().build();
        }
        Path path = Paths.get(record.getFilePath());
        Resource resource = new FileSystemResource(path);
        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + record.getFileName() + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    @PostMapping("/{id}/restore")
    @PreAuthorize("hasAuthority('backup:restore')")
    public R<Void> restore(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu, HttpServletRequest req) {
        backupService.restoreBackup(id, cu.getUserId(), clientIp(req), cu.getTenantId());
        return R.ok();
    }

    @PostMapping("/upload")
    @PreAuthorize("hasAuthority('backup:create')")
    public R<BackupRecordVO> upload(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file,
            @AuthenticationPrincipal SecurityUser cu,
            HttpServletRequest req) {
        return R.ok(backupService.importUpload(file, cu.getUserId(), clientIp(req), cu.getTenantId()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('backup:delete')")
    public R<Void> delete(@PathVariable Long id, @AuthenticationPrincipal SecurityUser cu, HttpServletRequest req) {
        backupService.delete(id, cu.getUserId(), clientIp(req), cu.getTenantId());
        return R.ok();
    }

    private String clientIp(HttpServletRequest req) {
        String xf = req.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) return xf.split(",")[0].trim();
        return req.getRemoteAddr();
    }
}
