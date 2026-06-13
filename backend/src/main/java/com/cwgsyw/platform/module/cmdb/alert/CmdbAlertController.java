package com.cwgsyw.platform.module.cmdb.alert;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.alert.dto.CmdbAlertVO;
import com.cwgsyw.platform.module.cmdb.alert.entity.CmdbAlert;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/cmdb/alerts")
@RequiredArgsConstructor
public class CmdbAlertController {

    private final CmdbAlertMapper alertMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final AuditLogMapper auditLogMapper;

    @GetMapping
    @PreAuthorize("hasPermission('cmdb_alert', 'read')")
    public R<PageResult<CmdbAlertVO>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String severity,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        String tid = cu.getTenantId();

        LambdaQueryWrapper<CmdbAlert> qw = new LambdaQueryWrapper<CmdbAlert>()
                .eq(CmdbAlert::getTenantId, tid)
                .eq(CmdbAlert::getIsDeleted, false)
                .orderByDesc(CmdbAlert::getStartsAt);

        if (status != null && !status.isBlank()) {
            qw = qw.eq(CmdbAlert::getStatus, status);
        }
        if (severity != null && !severity.isBlank()) {
            qw = qw.eq(CmdbAlert::getSeverity, severity);
        }

        Page<CmdbAlert> result = alertMapper.selectPage(new Page<>(page, size), qw);
        Map<Long, String> nameMap = resolveInstanceNames(result.getRecords(), tid);

        PageResult<CmdbAlertVO> pr = new PageResult<>();
        pr.setRecords(result.getRecords().stream().map(a -> toVO(a, nameMap)).toList());
        pr.setTotal(result.getTotal());
        pr.setPage(result.getCurrent());
        pr.setSize(result.getSize());
        return R.ok(pr);
    }

    @GetMapping("/by-instance/{instanceId}")
    @PreAuthorize("hasPermission('cmdb_alert', 'read')")
    public R<List<CmdbAlertVO>> byInstance(
            @PathVariable Long instanceId,
            @AuthenticationPrincipal SecurityUser cu) {
        String tid = cu.getTenantId();

        List<CmdbAlert> alerts = alertMapper.selectList(
                new LambdaQueryWrapper<CmdbAlert>()
                        .eq(CmdbAlert::getTenantId, tid)
                        .eq(CmdbAlert::getCiInstanceId, instanceId)
                        .eq(CmdbAlert::getIsDeleted, false)
                        .orderByDesc(CmdbAlert::getStartsAt));

        Map<Long, String> nameMap = resolveInstanceNames(alerts, tid);
        return R.ok(alerts.stream().map(a -> toVO(a, nameMap)).toList());
    }

    @PostMapping("/{id}/acknowledge")
    @PreAuthorize("hasPermission('cmdb_alert', 'acknowledge')")
    public R<CmdbAlertVO> acknowledge(
            @PathVariable Long id,
            @AuthenticationPrincipal SecurityUser cu) {
        String tid = cu.getTenantId();

        CmdbAlert alert = alertMapper.selectOne(
                new LambdaQueryWrapper<CmdbAlert>()
                        .eq(CmdbAlert::getId, id)
                        .eq(CmdbAlert::getTenantId, tid)
                        .eq(CmdbAlert::getIsDeleted, false));
        if (alert == null) {
            return R.fail("告警不存在");
        }

        alert.setAcknowledged(true);
        alert.setAcknowledgedAt(LocalDateTime.now());
        alert.setAcknowledgedBy(cu.getUserId());
        alert.setUpdatedBy(cu.getUserId());
        alertMapper.updateById(alert);

        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tid)
                .module("cmdb")
                .action("alert_acknowledged")
                .targetId(alert.getId())
                .targetType("cmdb_alert")
                .operatorId(cu.getUserId())
                .remark(alert.getAlertName())
                .createdAt(LocalDateTime.now())
                .build());

        Map<Long, String> nameMap = resolveInstanceNames(List.of(alert), tid);
        return R.ok(toVO(alert, nameMap));
    }

    // ---- helpers ----

    private Map<Long, String> resolveInstanceNames(List<CmdbAlert> alerts, String tenantId) {
        List<Long> instanceIds = alerts.stream()
                .map(CmdbAlert::getCiInstanceId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        if (instanceIds.isEmpty()) return Map.of();

        return ciInstanceMapper.selectList(
                        new LambdaQueryWrapper<CiInstance>()
                                .eq(CiInstance::getTenantId, tenantId)
                                .in(CiInstance::getId, instanceIds))
                .stream()
                .collect(Collectors.toMap(CiInstance::getId, CiInstance::getName, (a, b) -> a));
    }

    private CmdbAlertVO toVO(CmdbAlert a, Map<Long, String> nameMap) {
        CmdbAlertVO vo = new CmdbAlertVO();
        vo.setId(a.getId());
        vo.setCiInstanceId(a.getCiInstanceId());
        vo.setCiInstanceName(a.getCiInstanceId() != null ? nameMap.get(a.getCiInstanceId()) : null);
        vo.setAlertName(a.getAlertName());
        vo.setSeverity(a.getSeverity());
        vo.setStatus(a.getStatus());
        vo.setSummary(a.getSummary());
        vo.setDescription(a.getDescription());
        vo.setStartsAt(a.getStartsAt());
        vo.setEndsAt(a.getEndsAt());
        vo.setAcknowledged(a.getAcknowledged());
        vo.setCreatedAt(a.getCreatedAt());
        return vo;
    }
}
