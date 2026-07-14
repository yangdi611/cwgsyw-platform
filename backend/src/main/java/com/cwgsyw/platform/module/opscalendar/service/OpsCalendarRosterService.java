package com.cwgsyw.platform.module.opscalendar.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.opscalendar.dto.RosterConflictVO;
import com.cwgsyw.platform.module.opscalendar.dto.RosterRequest;
import com.cwgsyw.platform.module.opscalendar.dto.RosterVO;
import com.cwgsyw.platform.module.opscalendar.entity.OpsDutyRoster;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsDutyRosterMapper;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.ActiveGroupReferenceValidator;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 运维排班服务：CRUD + 冲突检测。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OpsCalendarRosterService {

    private final OpsDutyRosterMapper rosterMapper;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final AuditLogMapper auditLogMapper;
    private final ActiveGroupReferenceValidator activeGroupReferenceValidator;

    public List<RosterVO> list(String tenantId, LocalDate from, LocalDate to, Long groupId) {
        LambdaQueryWrapper<OpsDutyRoster> qw = new LambdaQueryWrapper<OpsDutyRoster>()
                .eq(OpsDutyRoster::getTenantId, tenantId)
                .ge(from != null, OpsDutyRoster::getDutyDate, from)
                .le(to != null, OpsDutyRoster::getDutyDate, to)
                .eq(groupId != null, OpsDutyRoster::getGroupId, groupId)
                .orderByAsc(OpsDutyRoster::getDutyDate);
        List<OpsDutyRoster> rosters = rosterMapper.selectList(qw);
        Set<Long> activeGroupIds = rosters.stream()
            .filter(roster -> roster.getDutyDate() == null || !roster.getDutyDate().isBefore(LocalDate.now()))
            .map(OpsDutyRoster::getGroupId)
            .filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> historicalGroupIds = rosters.stream()
            .filter(roster -> roster.getDutyDate() != null && roster.getDutyDate().isBefore(LocalDate.now()))
            .map(OpsDutyRoster::getGroupId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, Group> groupCache = new HashMap<>();
        if (!activeGroupIds.isEmpty()) {
            groupMapper.selectBatchIds(activeGroupIds).forEach(group -> groupCache.put(group.getId(), group));
        }
        if (!historicalGroupIds.isEmpty()) {
            groupMapper.findIncludingDeletedByIds(tenantId, historicalGroupIds)
                .forEach(group -> groupCache.put(group.getId(), group));
        }
        return rosters.stream().map(roster -> toVO(roster, groupCache)).collect(Collectors.toList());
    }

    @Transactional
    public RosterVO create(RosterRequest req, String tenantId, Long operatorId) {
        activeGroupReferenceValidator.lockAndRequire(tenantId, req.getGroupId());
        OpsDutyRoster r = new OpsDutyRoster();
        r.setTenantId(tenantId);
        applyRequest(r, req);
        rosterMapper.insert(r);
        writeAudit(tenantId, "create", r.getId(), operatorId, null);
        return toVO(r, null);
    }

    @Transactional
    public RosterVO update(Long id, RosterRequest req, String tenantId, Long operatorId) {
        OpsDutyRoster r = rosterMapper.selectById(id);
        if (r == null || !tenantId.equals(r.getTenantId())) throw new IllegalArgumentException("排班记录不存在");
        activeGroupReferenceValidator.lockAndRequire(tenantId, req.getGroupId());
        applyRequest(r, req);
        rosterMapper.updateById(r);
        writeAudit(tenantId, "update", id, operatorId, null);
        return toVO(r, null);
    }

    private void applyRequest(OpsDutyRoster r, RosterRequest req) {
        if (req.getDutyDate() != null) r.setDutyDate(req.getDutyDate());
        r.setStartAt(req.getStartAt());
        r.setEndAt(req.getEndAt());
        if (req.getShiftName() != null) r.setShiftName(req.getShiftName());
        if (req.getAssigneeId() != null) r.setAssigneeId(req.getAssigneeId());
        r.setBackupAssigneeId(req.getBackupAssigneeId());
        r.setPhoneOverride(req.getPhoneOverride());
        r.setGroupId(req.getGroupId());
        r.setRemark(req.getRemark());
    }

    /** 冲突检测：同一人同一天重复排班、缺少联系方式。 */
    public RosterConflictVO checkConflicts(String tenantId, RosterRequest req) {
        RosterConflictVO result = new RosterConflictVO();
        if (req.getDutyDate() == null || req.getAssigneeId() == null) return result;
        // 重复排班
        List<OpsDutyRoster> sameDay = rosterMapper.selectList(new LambdaQueryWrapper<OpsDutyRoster>()
                .eq(OpsDutyRoster::getTenantId, tenantId)
                .eq(OpsDutyRoster::getDutyDate, req.getDutyDate())
                .eq(OpsDutyRoster::getAssigneeId, req.getAssigneeId()));
        if (!sameDay.isEmpty()) {
            User u = userMapper.selectById(req.getAssigneeId());
            String name = u != null ? (u.getRealName() != null ? u.getRealName() : u.getUsername()) : "用户";
            result.getConflicts().add(new RosterConflictVO.Conflict(
                    "duplicate_assignee",
                    name + "在 " + req.getDutyDate() + " 已存在" + sameDay.get(0).getShiftName() + "排班",
                    sameDay.get(0).getId()));
        }
        // 缺少联系方式
        User u = userMapper.selectById(req.getAssigneeId());
        String phone = req.getPhoneOverride() != null ? req.getPhoneOverride()
                : (u != null ? u.getPhone() : null);
        if (phone == null || phone.isBlank()) {
            String name = u != null ? (u.getRealName() != null ? u.getRealName() : u.getUsername()) : "用户";
            result.getWarnings().add(new RosterConflictVO.Conflict(
                    "missing_phone", name + "缺少手机号", null));
        }
        return result;
    }

    private RosterVO toVO(OpsDutyRoster r, Map<Long, Group> groupCache) {
        RosterVO vo = new RosterVO();
        vo.setId(r.getId());
        vo.setDutyDate(r.getDutyDate());
        vo.setStartAt(r.getStartAt());
        vo.setEndAt(r.getEndAt());
        vo.setShiftName(r.getShiftName());
        vo.setAssigneeId(r.getAssigneeId());
        vo.setBackupAssigneeId(r.getBackupAssigneeId());
        vo.setPhoneOverride(r.getPhoneOverride());
        vo.setGroupId(r.getGroupId());
        vo.setRemark(r.getRemark());
        if (r.getAssigneeId() != null) {
            User u = userMapper.selectById(r.getAssigneeId());
            if (u != null) {
                vo.setAssigneeName(u.getRealName() != null ? u.getRealName() : u.getUsername());
                vo.setAssigneePhone(r.getPhoneOverride() != null ? r.getPhoneOverride() : u.getPhone());
            }
        }
        if (r.getBackupAssigneeId() != null) {
            User u = userMapper.selectById(r.getBackupAssigneeId());
            if (u != null) vo.setBackupAssigneeName(u.getRealName() != null ? u.getRealName() : u.getUsername());
        }
        if (r.getGroupId() != null) {
            boolean historical = r.getDutyDate() != null && r.getDutyDate().isBefore(LocalDate.now());
            Group g = groupCache != null ? groupCache.get(r.getGroupId())
                : historical
                    ? groupMapper.findByTenantAndIdIncludingDeleted(r.getTenantId(), r.getGroupId())
                    : groupMapper.selectById(r.getGroupId());
            if (g != null && (historical || !Boolean.TRUE.equals(g.getIsDeleted()))) {
                vo.setGroupName(g.getName());
                vo.setGroupArchived(Boolean.TRUE.equals(g.getIsDeleted()));
            }
        }
        return vo;
    }

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("ops_calendar").action(action)
                .targetId(targetId).targetType("ops_duty_roster")
                .operatorId(operatorId).remark(remark)
                .createdAt(LocalDateTime.now()).build());
    }
}
