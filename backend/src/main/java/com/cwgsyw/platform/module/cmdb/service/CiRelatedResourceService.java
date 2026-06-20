package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.changedoc.ChangeDocLinkService;
import com.cwgsyw.platform.module.changedoc.dto.LinkedChangeDocVO;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.daily.DailyReportMapper;
import com.cwgsyw.platform.module.daily.dto.DailyReportBriefVO;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.device.DeviceMapper;
import com.cwgsyw.platform.module.device.dto.DeviceVO;
import com.cwgsyw.platform.module.device.entity.Device;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Cross-module related-resource lookups for a CI instance (Issue #64 AC9):
 * devices, change documents, and daily reports linked to an instance. Extracted
 * from the former {@code CiInstanceService} with behaviour unchanged.
 */
@Service
@RequiredArgsConstructor
public class CiRelatedResourceService {

    private final CiInstanceMapper ciInstanceMapper;
    private final DeviceMapper deviceMapper;
    private final DailyReportMapper dailyReportMapper;
    private final ChangeDocLinkService changeDocLinkService;
    private final UserMapper userMapper;

    public List<DeviceVO> getRelatedDevices(Long instanceId, String tenantId) {
        loadInstance(instanceId, tenantId);
        LambdaQueryWrapper<Device> query = new LambdaQueryWrapper<Device>()
                .eq(Device::getCiInstanceId, instanceId)
                .eq(Device::getIsDeleted, false)
                .eq(Device::getTenantId, tenantId)
                .orderByDesc(Device::getCreatedAt);
        List<Device> devices = deviceMapper.selectList(query);
        return devices.stream().map(d -> {
            DeviceVO vo = new DeviceVO();
            vo.setId(d.getId());
            vo.setName(d.getName());
            vo.setIp(d.getIp());
            vo.setDeviceType(d.getDeviceType());
            vo.setCategory(d.getCategory());
            vo.setDescription(d.getDescription());
            vo.setCiInstanceId(d.getCiInstanceId());
            vo.setCreatedAt(d.getCreatedAt());
            vo.setUpdatedAt(d.getUpdatedAt());
            return vo;
        }).collect(Collectors.toList());
    }

    public List<LinkedChangeDocVO> getRelatedChangeDocs(Long instanceId, String tenantId) {
        loadInstance(instanceId, tenantId);
        return changeDocLinkService.listLinkedChangeDocs(instanceId, tenantId);
    }

    public List<DailyReportBriefVO> getRelatedDailyReports(Long instanceId, String tenantId) {
        loadInstance(instanceId, tenantId);
        List<DailyReport> reports = dailyReportMapper.findByCiInstanceId(instanceId);
        Set<Long> reporterIds = reports.stream()
                .map(DailyReport::getReporterId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        Map<Long, String> reporterNames = resolveUserNames(reporterIds);

        return reports.stream().map(r -> {
            DailyReportBriefVO vo = new DailyReportBriefVO();
            vo.setId(r.getId());
            vo.setReporterName(reporterNames.getOrDefault(r.getReporterId(), "未知"));
            vo.setReportDate(r.getReportDate());
            vo.setStatus(r.getStatus());
            String brief = r.getCompletedItems();
            if (brief != null && brief.length() > 100) {
                brief = brief.substring(0, 100) + "...";
            }
            vo.setCompletedItemsBrief(brief);
            return vo;
        }).collect(Collectors.toList());
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private CiInstance loadInstance(Long id, String tenantId) {
        CiInstance inst = ciInstanceMapper.selectById(id);
        if (inst == null || inst.getIsDeleted() || !inst.getTenantId().equals(tenantId))
            throw new IllegalArgumentException("实例不存在");
        return inst;
    }

    private Map<Long, String> resolveUserNames(Set<Long> userIds) {
        if (userIds.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u.getRealName() != null ? u.getRealName() : u.getUsername(), (a, b) -> a));
    }
}
