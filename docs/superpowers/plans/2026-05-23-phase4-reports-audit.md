# Phase 4: Reports & Audit Log UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add monthly/quarterly daily-report aggregation export (Excel) and an audit log query UI for admins.

**Architecture:** Two independent subsystems. (1) Report export: a new `ReportExportService` aggregates approved daily reports by month/quarter using existing `DailyReportMapper`, serialises to Excel via `XSSFWorkbook` (poi-ooxml already in pom.xml), streams as download. A new `GET /api/reports/export` endpoint handles format, period, and groupId params. Frontend adds a `/reports` page with period picker and export button. (2) Audit log UI: a new `GET /api/audit-logs` endpoint pages through `audit_log` with filters; frontend adds `/admin/audit` page. No new DB migrations needed.

**Tech Stack:** Apache POI XSSFWorkbook (already in pom.xml), Spring Boot 3.4.5, MyBatis-Plus, Next.js 15, TanStack Query v5, shadcn/ui

---

## File Map

**Backend — new:**
- `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/report/ReportController.java`
- `backend/src/main/java/com/cwgsyw/platform/module/audit/AuditLogController.java`
- `backend/src/main/java/com/cwgsyw/platform/module/audit/dto/AuditLogVO.java`

**Backend — modified:**
- `backend/src/main/java/com/cwgsyw/platform/common/AuditLogMapper.java` — add paginated query method

**Frontend — new:**
- `frontend/src/app/(dashboard)/reports/page.tsx` — monthly/quarterly report export page
- `frontend/src/app/(dashboard)/admin/audit/page.tsx` — audit log query page

**Frontend — modified:**
- `frontend/src/components/layout/Sidebar.tsx` — add Reports and Audit nav items

---

## Task 1: AuditLogMapper + AuditLogController

**Files:**
- Modify: `backend/src/main/java/com/cwgsyw/platform/common/AuditLogMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/audit/dto/AuditLogVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/audit/AuditLogController.java`

- [ ] **Step 1: Add query method to AuditLogMapper**

```java
// backend/src/main/java/com/cwgsyw/platform/common/AuditLogMapper.java
package com.cwgsyw.platform.common;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.entity.AuditLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface AuditLogMapper extends BaseMapper<AuditLog> {

    @Select("""
        SELECT * FROM audit_log
        WHERE tenant_id = #{tenantId}
          AND (#{module} IS NULL OR module = #{module})
          AND (#{operatorId} IS NULL OR operator_id = #{operatorId})
          AND (#{startDate} IS NULL OR created_at >= #{startDate}::timestamp)
          AND (#{endDate} IS NULL OR created_at < (#{endDate}::date + INTERVAL '1 day')::timestamp)
        ORDER BY created_at DESC
        """)
    Page<AuditLog> queryPage(Page<AuditLog> page,
                              @Param("tenantId")   String tenantId,
                              @Param("module")     String module,
                              @Param("operatorId") Long operatorId,
                              @Param("startDate")  String startDate,
                              @Param("endDate")    String endDate);
}
```

- [ ] **Step 2: Create AuditLogVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/audit/dto/AuditLogVO.java
package com.cwgsyw.platform.module.audit.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class AuditLogVO {
    private Long id;
    private String module;
    private String action;
    private Long targetId;
    private String targetType;
    private Long operatorId;
    private String operatorName;
    private String operatorIp;
    private String remark;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 3: Create AuditLogController**

```java
// backend/src/main/java/com/cwgsyw/platform/module/audit/AuditLogController.java
package com.cwgsyw.platform.module.audit;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.audit.dto.AuditLogVO;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;

    @GetMapping
    @PreAuthorize("hasAuthority('audit:read')")
    public R<PageResult<AuditLogVO>> list(
            @RequestParam(required = false) String module,
            @RequestParam(required = false) Long operatorId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser user) {

        Page<AuditLog> result = auditLogMapper.queryPage(
                new Page<>(page, size),
                user.getTenantId(), module, operatorId, startDate, endDate);

        // Batch-fetch operator names
        Set<Long> operatorIds = result.getRecords().stream()
                .map(AuditLog::getOperatorId).collect(Collectors.toSet());
        Map<Long, String> names = operatorIds.isEmpty() ? Map.of() :
                userMapper.selectBatchIds(operatorIds).stream()
                        .collect(Collectors.toMap(
                                com.cwgsyw.platform.module.user.entity.User::getId,
                                u -> u.getRealName() != null ? u.getRealName() : u.getUsername()));

        return R.ok(PageResult.of(result.convert(log -> {
            AuditLogVO vo = new AuditLogVO();
            vo.setId(log.getId());
            vo.setModule(log.getModule());
            vo.setAction(log.getAction());
            vo.setTargetId(log.getTargetId());
            vo.setTargetType(log.getTargetType());
            vo.setOperatorId(log.getOperatorId());
            vo.setOperatorName(names.getOrDefault(log.getOperatorId(), String.valueOf(log.getOperatorId())));
            vo.setOperatorIp(log.getOperatorIp());
            vo.setRemark(log.getRemark());
            vo.setCreatedAt(log.getCreatedAt());
            return vo;
        })));
    }
}
```

- [ ] **Step 4: Build and smoke test**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -5
docker compose up -d backend && sleep 20

TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/audit-logs?page=1&size=5" | jq '{code: .code, total: .data.total, count: (.data.records | length)}'
```

Expected: `{"code":200,"total":N,"count":5}`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/common/AuditLogMapper.java \
        backend/src/main/java/com/cwgsyw/platform/module/audit/
git commit -m "feat: audit log query API with pagination and filters"
```

---

## Task 2: ReportExportService + ReportController

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/report/ReportController.java`

- [ ] **Step 1: Create ReportExportService**

```java
// backend/src/main/java/com/cwgsyw/platform/module/report/ReportExportService.java
package com.cwgsyw.platform.module.report;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.daily.DailyReportMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReportExportService {

    private final DailyReportMapper reportMapper;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;

    /**
     * Export approved daily reports for a period as Excel.
     *
     * @param tenantId  tenant
     * @param startDate inclusive start date (yyyy-MM-dd)
     * @param endDate   inclusive end date (yyyy-MM-dd)
     * @param groupId   optional group filter (null = all groups)
     */
    public byte[] exportExcel(String tenantId, String startDate, String endDate, Long groupId) {
        LocalDate start = LocalDate.parse(startDate);
        LocalDate end   = LocalDate.parse(endDate);

        LambdaQueryWrapper<DailyReport> q = new LambdaQueryWrapper<DailyReport>()
                .eq(DailyReport::getTenantId, tenantId)
                .eq(DailyReport::getStatus, "APPROVED")
                .ge(DailyReport::getReportDate, start)
                .le(DailyReport::getReportDate, end)
                .orderByAsc(DailyReport::getReportDate)
                .orderByAsc(DailyReport::getGroupId);
        if (groupId != null) q.eq(DailyReport::getGroupId, groupId);

        List<DailyReport> reports = reportMapper.selectList(q);

        // Batch fetch user and group names
        Map<Long, String> userNames = batchUserNames(reports);
        Map<Long, String> groupNames = batchGroupNames(reports);

        try (XSSFWorkbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("工作日报");
            sheet.setColumnWidth(0, 14 * 256);   // 日期
            sheet.setColumnWidth(1, 12 * 256);   // 姓名
            sheet.setColumnWidth(2, 12 * 256);   // 组
            sheet.setColumnWidth(3, 40 * 256);   // 完成事项
            sheet.setColumnWidth(4, 30 * 256);   // 遇到问题
            sheet.setColumnWidth(5, 30 * 256);   // 明日计划
            sheet.setColumnWidth(6, 8 * 256);    // 工时

            // Title row
            CellStyle titleStyle = titleStyle(wb);
            Row titleRow = sheet.createRow(0);
            titleRow.setHeightInPoints(24);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("工作日报汇总（" + startDate + " 至 " + endDate + "）");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 6));

            // Header row
            CellStyle headerStyle = headerStyle(wb);
            Row header = sheet.createRow(1);
            String[] headers = {"日期", "姓名", "组别", "今日完成事项", "遇到问题", "明日计划", "工时(h)"};
            for (int i = 0; i < headers.length; i++) {
                Cell c = header.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            // Data rows
            CellStyle bodyStyle  = bodyStyle(wb);
            CellStyle wrapStyle  = wrapStyle(wb);
            DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
            int rowIdx = 2;
            for (DailyReport r : reports) {
                Row row = sheet.createRow(rowIdx++);
                row.setHeightInPoints(60);
                cell(row, 0, r.getReportDate().format(dateFmt), bodyStyle);
                cell(row, 1, userNames.getOrDefault(r.getReporterId(), String.valueOf(r.getReporterId())), bodyStyle);
                cell(row, 2, groupNames.getOrDefault(r.getGroupId(), ""), bodyStyle);
                cell(row, 3, nvl(r.getCompletedItems()), wrapStyle);
                cell(row, 4, nvl(r.getIssues()), wrapStyle);
                cell(row, 5, nvl(r.getTomorrowPlan()), wrapStyle);
                if (r.getWorkHours() != null) {
                    row.createCell(6).setCellValue(r.getWorkHours().doubleValue());
                    row.getCell(6).setCellStyle(bodyStyle);
                }
            }

            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("生成 Excel 失败: " + e.getMessage(), e);
        }
    }

    // ── Style helpers ──────────────────────────────────────────────────────────

    private CellStyle titleStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 14);
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        return s;
    }

    private CellStyle headerStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        setBorder(s);
        return s;
    }

    private CellStyle bodyStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        setBorder(s);
        return s;
    }

    private CellStyle wrapStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setWrapText(true);
        s.setVerticalAlignment(VerticalAlignment.TOP);
        setBorder(s);
        return s;
    }

    private void setBorder(CellStyle s) {
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
    }

    private void cell(Row row, int col, String value, CellStyle style) {
        Cell c = row.createCell(col);
        c.setCellValue(value);
        c.setCellStyle(style);
    }

    private String nvl(String s) { return s != null ? s : ""; }

    private Map<Long, String> batchUserNames(List<DailyReport> reports) {
        var ids = reports.stream().map(DailyReport::getReporterId).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(ids).stream().collect(Collectors.toMap(
                com.cwgsyw.platform.module.user.entity.User::getId,
                u -> u.getRealName() != null ? u.getRealName() : u.getUsername()));
    }

    private Map<Long, String> batchGroupNames(List<DailyReport> reports) {
        var ids = reports.stream().filter(r -> r.getGroupId() != null)
                .map(DailyReport::getGroupId).collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return groupMapper.selectBatchIds(ids).stream().collect(Collectors.toMap(
                com.cwgsyw.platform.module.org.entity.Group::getId,
                com.cwgsyw.platform.module.org.entity.Group::getName));
    }
}
```

- [ ] **Step 2: Create ReportController**

```java
// backend/src/main/java/com/cwgsyw/platform/module/report/ReportController.java
package com.cwgsyw.platform.module.report;

import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportExportService reportExportService;

    @GetMapping("/export")
    @PreAuthorize("hasAuthority('daily_report:export')")
    public ResponseEntity<byte[]> export(
            @RequestParam String startDate,
            @RequestParam String endDate,
            @RequestParam(required = false) Long groupId,
            @AuthenticationPrincipal SecurityUser user) {

        byte[] bytes = reportExportService.exportExcel(
                user.getTenantId(), startDate, endDate, groupId);

        String filename = "日报汇总_" + startDate + "_" + endDate + ".xlsx";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename).build());
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        return ResponseEntity.ok().headers(headers).body(bytes);
    }
}
```

- [ ] **Step 3: Build and smoke test**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | grep -E "Built|ERROR|error" | head -5
docker compose up -d backend && sleep 20

TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/reports/export?startDate=2026-01-01&endDate=2026-12-31" \
  -o /tmp/report_test.xlsx
file /tmp/report_test.xlsx
ls -lh /tmp/report_test.xlsx
```

Expected: `Microsoft Excel 2007+` file, size > 4KB (even with no data it includes headers).

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/report/
git commit -m "feat: ReportExportService + ReportController - Excel export of approved daily reports"
```

---

## Task 3: Frontend — Reports Page

**Files:**
- Create: `frontend/src/app/(dashboard)/reports/page.tsx`

- [ ] **Step 1: Create reports page**

```tsx
// frontend/src/app/(dashboard)/reports/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { useAuthStore } from '@/store/authStore'

interface Group { id: number; name: string }

function getMonthRange(offset: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(y, d.getMonth() + 1, 0).getDate()
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${lastDay}` }
}

function getQuarterRange(offset: number) {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3) + offset
  const y = now.getFullYear() + Math.floor(q / 4)
  const qn = ((q % 4) + 4) % 4
  const startMonth = qn * 3 + 1
  const endMonth = startMonth + 2
  const lastDay = new Date(y, endMonth, 0).getDate()
  const sm = String(startMonth).padStart(2, '0')
  const em = String(endMonth).padStart(2, '0')
  return { start: `${y}-${sm}-01`, end: `${y}-${em}-${lastDay}` }
}

export default function ReportsPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const groupScope = useAuthStore(s => s.groupScope)
  const isAdmin = groupScope === 'tenant' || groupScope === 'platform'

  useEffect(() => {
    if (!hasPermission('daily_report', 'export')) router.replace('/')
  }, [hasPermission, router])

  const [startDate, setStartDate] = useState(() => getMonthRange(0).start)
  const [endDate, setEndDate]     = useState(() => getMonthRange(0).end)
  const [groupId, setGroupId]     = useState<string>('')
  const [exporting, setExporting] = useState(false)

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ['groups'],
    queryFn: () => api.get('/groups').then(r => r.data.data?.records ?? r.data.data ?? []),
    enabled: isAdmin,
  })

  const applyPreset = (preset: string) => {
    let r: { start: string; end: string }
    if (preset === 'thisMonth')  r = getMonthRange(0)
    else if (preset === 'lastMonth')  r = getMonthRange(-1)
    else if (preset === 'thisQuarter') r = getQuarterRange(0)
    else r = getQuarterRange(-1)
    setStartDate(r.start)
    setEndDate(r.end)
  }

  const handleExport = async () => {
    if (!startDate || !endDate) { toast.error('请选择日期范围'); return }
    if (startDate > endDate) { toast.error('开始日期不能晚于结束日期'); return }
    setExporting(true)
    try {
      const params: Record<string, string> = { startDate, endDate }
      if (groupId) params.groupId = groupId
      const res = await api.get('/reports/export', { params, responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `日报汇总_${startDate}_${endDate}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('报表已导出')
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold mb-2">报表导出</h1>
      <p className="text-sm text-muted-foreground mb-6">导出指定时间段内已审批通过的日报汇总（Excel 格式）</p>

      <div className="border rounded-lg p-6 space-y-5">
        {/* Quick presets */}
        <div className="space-y-1.5">
          <Label>快速选择</Label>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: '本月',   preset: 'thisMonth' },
              { label: '上月',   preset: 'lastMonth' },
              { label: '本季度', preset: 'thisQuarter' },
              { label: '上季度', preset: 'lastQuarter' },
            ].map(({ label, preset }) => (
              <Button key={preset} variant="outline" size="sm"
                onClick={() => applyPreset(preset)}>
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>开始日期</Label>
            <Input type="date" value={startDate}
              onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>结束日期</Label>
            <Input type="date" value={endDate}
              onChange={e => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* Group filter (admin only) */}
        {isAdmin && (
          <div className="space-y-1.5">
            <Label>按组过滤（可选）</Label>
            <Select value={groupId} onValueChange={v => setGroupId(v ?? '')}>
              <SelectTrigger><SelectValue placeholder="全部组" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部组</SelectItem>
                {groups.map((g: Group) => (
                  <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={handleExport} disabled={exporting} className="w-full">
          <Download className="h-4 w-4 mr-2" />
          {exporting ? '导出中...' : '导出 Excel'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(dashboard)/reports/page.tsx"
git commit -m "feat: reports export page with date range and group filter"
```

---

## Task 4: Frontend — Audit Log Page

**Files:**
- Create: `frontend/src/app/(dashboard)/admin/audit/page.tsx`

- [ ] **Step 1: Create audit log page**

```tsx
// frontend/src/app/(dashboard)/admin/audit/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { usePermission } from '@/hooks/usePermission'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditLogVO {
  id: number
  module: string
  action: string
  targetId: number
  targetType: string
  operatorId: number
  operatorName: string
  operatorIp: string
  remark: string
  createdAt: string
}

interface PageResult {
  records: AuditLogVO[]
  total: number
  page: number
  size: number
}

const MODULE_LABELS: Record<string, string> = {
  device: '设备密码库', change_doc: '变更文档', daily_report: '工作日报',
  sys_config: '系统配置', user: '用户管理', group: '组管理',
}

const ACTION_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  create: 'default', update: 'secondary', delete: 'destructive',
  approve: 'outline', reject: 'destructive', view_password: 'secondary',
}

export default function AuditLogPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()

  useEffect(() => {
    if (!hasPermission('audit', 'read')) router.replace('/')
  }, [hasPermission, router])

  const [module, setModule]       = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate]     = useState('')
  const [page, setPage]           = useState(1)
  const size = 20

  const { data, isLoading } = useQuery<PageResult>({
    queryKey: ['audit-logs', module, startDate, endDate, page],
    queryFn: () => {
      const params: Record<string, string | number> = { page, size }
      if (module) params.module = module
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      return api.get('/audit-logs', { params }).then(r => r.data.data)
    },
    enabled: hasPermission('audit', 'read'),
  })

  const totalPages = data ? Math.ceil(data.total / size) : 0

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">审计日志</h1>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap mb-4">
        <div className="space-y-1.5">
          <Label className="text-xs">模块</Label>
          <Select value={module} onValueChange={v => { setModule(v ?? ''); setPage(1) }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="全部" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部模块</SelectItem>
              {Object.entries(MODULE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">开始日期</Label>
          <Input type="date" className="w-40" value={startDate}
            onChange={e => { setStartDate(e.target.value); setPage(1) }} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">结束日期</Label>
          <Input type="date" className="w-40" value={endDate}
            onChange={e => { setEndDate(e.target.value); setPage(1) }} />
        </div>
        <div className="flex items-end">
          <Button variant="outline" size="sm" onClick={() => {
            setModule(''); setStartDate(''); setEndDate(''); setPage(1)
          }}>重置</Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">加载中...</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {['时间', '模块', '操作', '操作人', '目标', '备注', 'IP'].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {(data?.records ?? []).length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">暂无数据</td></tr>
              ) : (
                (data?.records ?? []).map(log => (
                  <tr key={log.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-3 py-2">{MODULE_LABELS[log.module] ?? log.module}</td>
                    <td className="px-3 py-2">
                      <Badge variant={ACTION_COLORS[log.action] ?? 'secondary'} className="text-xs">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{log.operatorName}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {log.targetType}{log.targetId ? ` #${log.targetId}` : ''}
                    </td>
                    <td className="px-3 py-2 text-xs max-w-xs truncate">{log.remark}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{log.operatorIp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-sm text-muted-foreground">
            共 {data?.total} 条，第 {page}/{totalPages} 页
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | tail -5
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/(dashboard)/admin/audit/page.tsx"
git commit -m "feat: audit log query page with module/date filters and pagination"
```

---

## Task 5: Sidebar Nav Items + Final Build

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add Reports and Audit nav items to Sidebar**

Read the current Sidebar.tsx to find the imports and navItems array, then:

Add `BarChart2` and `ClipboardList` to the lucide-react import line.

Add to `navItems` array (after 变更文档, before 用户管理):
```tsx
{ href: '/reports',      label: '报表导出', icon: BarChart2,     resource: 'daily_report', action: 'export' },
```

Add after 系统配置 (admin-only items at the bottom):
```tsx
{ href: '/admin/audit',  label: '审计日志', icon: ClipboardList, resource: 'audit',        action: 'read' },
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | tail -5
```

- [ ] **Step 3: Full rebuild and smoke test**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend frontend 2>&1 | tail -5
docker compose up -d
sleep 25

TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

# Test audit log API
echo "=== Audit Logs ===" 
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/audit-logs?page=1&size=5" | jq '{code, total: .data.total}'

# Test report export
echo "=== Report Export ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/reports/export?startDate=2026-01-01&endDate=2026-12-31" \
  -o /tmp/phase4_report.xlsx
file /tmp/phase4_report.xlsx

# Test audit log filters
echo "=== Audit Filter by module ==="
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/audit-logs?module=change_doc&page=1&size=3" | jq '{code, total: .data.total}'
```

Expected: audit-logs returns 200 with total > 0, report Excel file valid, filter works.

- [ ] **Step 4: Tag release**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add Reports and Audit Log nav items to Sidebar"
git tag v0.6.0-phase4
echo "Phase 4 complete: v0.6.0-phase4"
```

---

## RBAC Checklist

- [x] `audit:read` — already registered (V2 migration), `super_admin` and `admin` have it
- [x] `daily_report:export` — already registered (V4 migration), `super_admin`, `admin`, `group_leader` have it
- [x] Both endpoints have `@PreAuthorize`
- [x] Frontend pages redirect if missing required permission
- [x] Sidebar items gated by permission

---

## Self-Review

### Spec coverage
- ✅ 月报/季报聚合导出：Excel（XSSFWorkbook），按日期范围 + 可选组过滤
- ✅ 审计日志查询界面：分页、按模块/日期过滤、操作人显示
- ✅ 快速预设（本月/上月/本季度/上季度）

### No placeholders found.

### Type consistency
- `ReportExportService.exportExcel(tenantId, startDate, endDate, groupId)` → `byte[]`
- `AuditLogController` returns `R<PageResult<AuditLogVO>>`
- Frontend `api.get('/reports/export', { responseType: 'blob' })` for binary download
- `AuditLogVO.operatorName` resolved from `UserMapper.selectBatchIds`
