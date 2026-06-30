package com.cwgsyw.platform.module.opscalendar.service;

import com.cwgsyw.platform.module.opscalendar.dto.HolidayRequest;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * 中国法定节假日静态预置数据（不依赖外部 API）。
 * 数据为运营估算值，导入后管理员可在节假日历页面按国务院最终公告调整。
 * workdayOverrides 为调休补班日（JSON 数组字符串，形如 ["2026-02-15"]）。
 */
final class ChinaHolidayPresets {

    private ChinaHolidayPresets() {}

    static List<HolidayRequest> of(int year) {
        if (year == 2026) return year2026();
        return List.of();
    }

    private static List<HolidayRequest> year2026() {
        List<HolidayRequest> list = new ArrayList<>();
        list.add(h("元旦", "2026-01-01", "2026-01-01", "[]"));
        // 春节（除夕 2026-02-16，初一 02-17），放假 02-16~02-22，调休补班 02-15(周日)、02-28(周六)
        list.add(h("春节", "2026-02-16", "2026-02-22", "[\"2026-02-15\",\"2026-02-28\"]"));
        // 清明节 04-04~04-06
        list.add(h("清明节", "2026-04-04", "2026-04-06", "[]"));
        // 劳动节 05-01~05-05，调休补班 05-09(周六)
        list.add(h("劳动节", "2026-05-01", "2026-05-05", "[\"2026-05-09\"]"));
        // 端午节 06-19~06-21
        list.add(h("端午节", "2026-06-19", "2026-06-21", "[]"));
        // 中秋节 09-25~09-27
        list.add(h("中秋节", "2026-09-25", "2026-09-27", "[]"));
        // 国庆节 10-01~10-08，调休补班 09-28(周一?) 实际以公告为准，预置 10-10(周六)
        list.add(h("国庆节", "2026-10-01", "2026-10-08", "[\"2026-10-10\"]"));
        return list;
    }

    private static HolidayRequest h(String name, String start, String end, String overrides) {
        HolidayRequest r = new HolidayRequest();
        r.setName(name);
        r.setStartDate(LocalDate.parse(start));
        r.setEndDate(LocalDate.parse(end));
        r.setHolidayType("legal");
        r.setWorkdayOverrides(overrides);
        r.setEnabled(true);
        r.setRemark("内置中国法定节假日（估算值，请按国务院公告核对）");
        return r;
    }
}
