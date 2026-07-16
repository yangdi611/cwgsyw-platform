package com.cwgsyw.platform.module.report;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportExportService reportExportService;
    private final AuditLogMapper auditLogMapper;

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('daily_report:export')")
    public ResponseEntity<byte[]> export(
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam(required = false) Long groupId,
            @AuthenticationPrincipal SecurityUser user) {

        LocalDate start = parseDate(startDate, "开始日期");
        LocalDate end = parseDate(endDate, "结束日期");
        if (start.isAfter(end)) {
            throw new IllegalArgumentException("开始日期不能晚于结束日期");
        }
        Long effectiveGroupId = effectiveGroupId(user, groupId);

        byte[] bytes = reportExportService.exportExcel(
                user.getTenantId(), startDate, endDate, effectiveGroupId);

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(user.getTenantId()).module("daily_report").action("export")
                .targetType("daily_report_export").operatorId(user.getUserId())
                .afterJson("{\"startDate\":\"" + startDate + "\",\"endDate\":\"" + endDate
                        + "\",\"groupId\":" + (effectiveGroupId == null ? "null" : effectiveGroupId) + "}")
                .remark("scope=" + user.getGroupScope())
                .createdAt(LocalDateTime.now())
                .build());

        String filename = "日报汇总_" + startDate + "_" + endDate + ".xlsx";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        return ResponseEntity.ok().headers(headers).body(bytes);
    }

    private Long effectiveGroupId(SecurityUser user, Long requestedGroupId) {
        if (!"group".equals(user.getGroupScope())) {
            return requestedGroupId;
        }
        if (user.getGroupId() == null) {
            throw new AccessDeniedException("组级用户未关联用户组，不能导出日报");
        }
        if (requestedGroupId != null && !user.getGroupId().equals(requestedGroupId)) {
            throw new AccessDeniedException("组级用户只能导出本组日报");
        }
        return user.getGroupId();
    }

    private LocalDate parseDate(String value, String label) {
        try {
            return LocalDate.parse(value);
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException(label + "格式必须为 yyyy-MM-dd");
        }
    }
}
