package com.cwgsyw.platform.module.opscalendar.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.opscalendar.dto.HolidayRequest;
import com.cwgsyw.platform.module.opscalendar.dto.HolidayVO;
import com.cwgsyw.platform.module.opscalendar.entity.OpsHolidayCalendar;
import com.cwgsyw.platform.module.opscalendar.mapper.OpsHolidayCalendarMapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * 节假日历服务：CRUD + 工作日判断（isWorkday）。
 * 工作日推算用于 Phase 4 的 holiday_relative / 季末 N 工作日。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OpsCalendarHolidayService {

    private final OpsHolidayCalendarMapper holidayMapper;
    private final AuditLogMapper auditLogMapper;
    private final ObjectMapper objectMapper;

    public List<HolidayVO> list(String tenantId) {
        List<OpsHolidayCalendar> rows = holidayMapper.selectList(
                new LambdaQueryWrapper<OpsHolidayCalendar>()
                        .eq(OpsHolidayCalendar::getTenantId, tenantId)
                        .orderByAsc(OpsHolidayCalendar::getStartDate));
        List<HolidayVO> vos = new ArrayList<>();
        for (OpsHolidayCalendar h : rows) vos.add(toVO(h));
        return vos;
    }

    @Transactional
    public HolidayVO create(HolidayRequest req, String tenantId, Long operatorId) {
        OpsHolidayCalendar h = new OpsHolidayCalendar();
        h.setTenantId(tenantId);
        applyRequest(h, req);
        holidayMapper.insert(h);
        writeAudit(tenantId, "create", h.getId(), operatorId, "name=" + h.getName());
        return toVO(h);
    }

    @Transactional
    public HolidayVO update(Long id, HolidayRequest req, String tenantId, Long operatorId) {
        OpsHolidayCalendar h = holidayMapper.selectById(id);
        if (h == null || !h.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("节假日不存在");
        }
        applyRequest(h, req);
        holidayMapper.updateById(h);
        writeAudit(tenantId, "update", id, operatorId, "name=" + h.getName());
        return toVO(h);
    }

    @Transactional
    public void delete(Long id, String tenantId, Long operatorId) {
        OpsHolidayCalendar h = holidayMapper.selectById(id);
        if (h == null || !h.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("节假日不存在");
        }
        h.setDeletedAt(LocalDateTime.now());
        h.setDeletedBy(operatorId);
        holidayMapper.updateById(h);
        holidayMapper.deleteById(id);
        writeAudit(tenantId, "delete", id, operatorId, "name=" + h.getName());
    }

    /**
     * 一键导入指定年份的中国法定节假日（静态数据，不依赖外部 API）。
     * 幂等：同名+同起始日已存在则跳过。返回新增条数。
     */
    @Transactional
    public int importChinaHolidays(int year, String tenantId, Long operatorId) {
        List<HolidayRequest> presets = ChinaHolidayPresets.of(year);
        if (presets.isEmpty()) throw new IllegalArgumentException("暂无 " + year + " 年的内置节假日数据（当前支持 2026）");
        int created = 0;
        for (HolidayRequest req : presets) {
            Long exist = holidayMapper.selectCount(new LambdaQueryWrapper<OpsHolidayCalendar>()
                    .eq(OpsHolidayCalendar::getTenantId, tenantId)
                    .eq(OpsHolidayCalendar::getName, req.getName())
                    .eq(OpsHolidayCalendar::getStartDate, req.getStartDate()));
            if (exist != null && exist > 0) continue;
            OpsHolidayCalendar h = new OpsHolidayCalendar();
            h.setTenantId(tenantId);
            applyRequest(h, req);
            holidayMapper.insert(h);
            created++;
        }
        writeAudit(tenantId, "import", null, operatorId, "china_holidays_" + year + " 新增" + created + "条");
        return created;
    }

    private void applyRequest(OpsHolidayCalendar h, HolidayRequest req) {
        h.setName(req.getName());
        h.setStartDate(req.getStartDate());
        h.setEndDate(req.getEndDate());
        if (req.getHolidayType() != null) h.setHolidayType(req.getHolidayType());
        if (req.getWorkdayOverrides() != null) h.setWorkdayOverrides(req.getWorkdayOverrides());
        if (req.getEnabled() != null) h.setEnabled(req.getEnabled());
        h.setRemark(req.getRemark());
    }

    /** 判断某日是否工作日：在节假日区间内=非工作日，调休补班日=工作日，周末=非工作日，其余=工作日。 */
    public boolean isWorkday(String tenantId, LocalDate date) {
        List<OpsHolidayCalendar> holidays = holidayMapper.selectList(
                new LambdaQueryWrapper<OpsHolidayCalendar>()
                        .eq(OpsHolidayCalendar::getTenantId, tenantId)
                        .eq(OpsHolidayCalendar::getEnabled, true)
                        .le(OpsHolidayCalendar::getStartDate, date)
                        .ge(OpsHolidayCalendar::getEndDate, date));
        for (OpsHolidayCalendar h : holidays) {
            if (!date.isBefore(h.getStartDate()) && !date.isAfter(h.getEndDate())) {
                return false; // 在假期区间内
            }
        }
        // 调休补班：workday_overrides 包含该日则强制为工作日
        List<OpsHolidayCalendar> all = holidayMapper.selectList(
                new LambdaQueryWrapper<OpsHolidayCalendar>()
                        .eq(OpsHolidayCalendar::getTenantId, tenantId)
                        .eq(OpsHolidayCalendar::getEnabled, true));
        for (OpsHolidayCalendar h : all) {
            for (String d : parseOverrides(h.getWorkdayOverrides())) {
                if (d.equals(date.toString())) return true;
            }
        }
        DayOfWeek dow = date.getDayOfWeek();
        return dow != DayOfWeek.SATURDAY && dow != DayOfWeek.SUNDAY;
    }

    /** 向前/向后移动 N 个工作日。offset 为负=向前，正=向后。 */
    public LocalDate moveWorkdays(String tenantId, LocalDate from, int offsetWorkdays) {
        if (offsetWorkdays == 0) return from;
        int step = offsetWorkdays > 0 ? 1 : -1;
        int remaining = Math.abs(offsetWorkdays);
        LocalDate cursor = from;
        while (remaining > 0) {
            cursor = cursor.plusDays(step);
            if (isWorkday(tenantId, cursor)) remaining--;
        }
        return cursor;
    }

    /** 返回与 [from, to] 有交集的启用节假日（供 holiday_relative occurrence 计算）。 */
    public List<OpsHolidayCalendar> holidaysInRange(String tenantId, LocalDate from, LocalDate to) {
        return holidayMapper.selectList(new LambdaQueryWrapper<OpsHolidayCalendar>()
                .eq(OpsHolidayCalendar::getTenantId, tenantId)
                .eq(OpsHolidayCalendar::getEnabled, true)
                // 交集：start <= to AND end >= from
                .le(OpsHolidayCalendar::getStartDate, to)
                .ge(OpsHolidayCalendar::getEndDate, from)
                .orderByAsc(OpsHolidayCalendar::getStartDate));
    }

    /** 返回某日的节假日名称（若有）。 */
    public String holidayNameOf(String tenantId, LocalDate date) {
        List<OpsHolidayCalendar> holidays = holidayMapper.selectList(
                new LambdaQueryWrapper<OpsHolidayCalendar>()
                        .eq(OpsHolidayCalendar::getTenantId, tenantId)
                        .eq(OpsHolidayCalendar::getEnabled, true)
                        .le(OpsHolidayCalendar::getStartDate, date)
                        .ge(OpsHolidayCalendar::getEndDate, date));
        return holidays.isEmpty() ? null : holidays.get(0).getName();
    }

    private List<String> parseOverrides(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return objectMapper.readValue(json, objectMapper.getTypeFactory()
                    .constructCollectionType(List.class, String.class));
        } catch (Exception e) {
            return List.of();
        }
    }

    private HolidayVO toVO(OpsHolidayCalendar h) {
        HolidayVO vo = new HolidayVO();
        vo.setId(h.getId());
        vo.setName(h.getName());
        vo.setStartDate(h.getStartDate());
        vo.setEndDate(h.getEndDate());
        vo.setHolidayType(h.getHolidayType());
        vo.setWorkdayOverrides(h.getWorkdayOverrides());
        vo.setEnabled(h.getEnabled());
        vo.setRemark(h.getRemark());
        return vo;
    }

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("ops_calendar").action(action)
                .targetId(targetId).targetType("ops_holiday_calendar")
                .operatorId(operatorId).remark(remark)
                .createdAt(LocalDateTime.now()).build());
    }
}
