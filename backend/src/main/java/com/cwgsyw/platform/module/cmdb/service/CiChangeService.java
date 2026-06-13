package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.changes.*;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CiChangeService {

    private static final String STATS_CACHE_PREFIX = "cmdb:stats:";
    private static final long STATS_CACHE_TTL_SECONDS = 300;
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final AuditLogMapper auditLogMapper;
    private final UserMapper userMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final CiModelMapper ciModelMapper;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    // ─── Instance History ────────────────────────────────────────────────────

    public PageResult<ChangeHistoryV2VO> getInstanceHistory(Long instanceId, String from, String to,
                                                             Long operatorId, String action,
                                                             int page, int size, String tenantId) {
        Page<AuditLog> p = auditLogMapper.queryChanges(
                new Page<>(page, size), tenantId,
                List.of("ci_instance"), instanceId, action, operatorId, from, to);

        Map<Long, String> operatorNames = resolveOperatorNames(p.getRecords());
        List<ChangeHistoryV2VO> records = p.getRecords().stream()
                .map(a -> toV2VO(a, operatorNames))
                .collect(Collectors.toList());

        PageResult<ChangeHistoryV2VO> result = new PageResult<>();
        result.setRecords(records);
        result.setTotal(p.getTotal());
        result.setPage(p.getCurrent());
        result.setSize(p.getSize());
        return result;
    }

    // ─── Global Changes ─────────────────────────────────────────────────────

    public PageResult<ChangeHistoryV2VO> getGlobalChanges(String entityType, Long entityId,
                                                          String modelId, String from, String to,
                                                          Long operatorId, String action,
                                                          int page, int size, String tenantId) {
        List<String> targetTypes = "ci_instance_rel".equals(entityType)
                ? List.of("ci_instance_rel") : List.of("ci_instance");

        Page<AuditLog> p = auditLogMapper.queryChanges(
                new Page<>(page, size), tenantId,
                targetTypes, entityId, action, operatorId, from, to);

        Map<Long, String> operatorNames = resolveOperatorNames(p.getRecords());

        List<ChangeHistoryV2VO> records = p.getRecords().stream()
                .map(a -> toV2VO(a, operatorNames))
                .collect(Collectors.toList());

        // Filter by modelId if specified (check afterJson modelId field)
        if (modelId != null && "ci_instance".equals(entityType)) {
            records = records.stream()
                    .filter(vo -> matchesModelId(vo, modelId))
                    .collect(Collectors.toList());
        }

        PageResult<ChangeHistoryV2VO> result = new PageResult<>();
        result.setRecords(records);
        result.setTotal(p.getTotal());
        result.setPage(p.getCurrent());
        result.setSize(p.getSize());
        return result;
    }

    // ─── Stats ──────────────────────────────────────────────────────────────

    public ChangeStatsVO getStats(String modelId, String from, String to, String tenantId) {
        String cacheKey = buildStatsCacheKey(modelId, from, to);

        // Check Redis cache
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return objectMapper.readValue(cached, ChangeStatsVO.class);
            }
        } catch (Exception e) {
            log.warn("Failed to read stats cache: {}", e.getMessage());
        }

        // Compute stats
        LocalDate now = LocalDate.now();
        String fromResolved = from != null ? from : now.minusDays(30).atStartOfDay().toString();
        String toResolved = to != null ? to : now.plusDays(1).atStartOfDay().toString();

        ChangeStatsVO stats = new ChangeStatsVO();

        // Today / thisWeek / thisMonth counts
        String todayStart = now.atStartOfDay().toString();
        String tomorrowStart = now.plusDays(1).atStartOfDay().toString();
        stats.setToday(computeActionCounts(tenantId, todayStart, tomorrowStart, modelId));

        String weekStart = now.minusDays(now.getDayOfWeek().getValue() - 1).atStartOfDay().toString();
        stats.setThisWeek(computeActionCounts(tenantId, weekStart, tomorrowStart, modelId));

        String monthStart = now.withDayOfMonth(1).atStartOfDay().toString();
        stats.setThisMonth(computeActionCounts(tenantId, monthStart, tomorrowStart, modelId));

        // Daily breakdown
        stats.setDailyBreakdown(computeDailyBreakdown(tenantId, fromResolved, toResolved, modelId));

        // Top 10 instances
        stats.setTop10Instances(computeTop10Instances(tenantId, fromResolved, tenantId));

        // Cache the result
        try {
            String json = objectMapper.writeValueAsString(stats);
            redisTemplate.opsForValue().set(cacheKey, json, STATS_CACHE_TTL_SECONDS, TimeUnit.SECONDS);
        } catch (Exception e) {
            log.warn("Failed to write stats cache: {}", e.getMessage());
        }

        return stats;
    }

    // ─── Cache Invalidation ─────────────────────────────────────────────────

    public void invalidateStatsCache() {
        try {
            Set<String> keys = redisTemplate.keys(STATS_CACHE_PREFIX + "*");
            if (keys != null && !keys.isEmpty()) {
                redisTemplate.delete(keys);
                log.debug("Invalidated {} stats cache keys", keys.size());
            }
        } catch (Exception e) {
            log.warn("Failed to invalidate stats cache: {}", e.getMessage());
        }
    }

    // ─── Changed Fields Computation (static) ────────────────────────────────

    public static ChangedFieldsResult computeChangedFields(Map<String, Object> beforeJson,
                                                            Map<String, Object> afterJson) {
        ChangedFieldsResult result = new ChangedFieldsResult();

        if (beforeJson == null && afterJson != null) {
            result.fields = new ArrayList<>(afterJson.keySet());
            result.summary = "创建了实例";
            return result;
        }

        if (beforeJson != null && afterJson == null) {
            result.fields = new ArrayList<>(beforeJson.keySet());
            result.summary = "删除了实例";
            return result;
        }

        if (beforeJson == null) {
            result.fields = List.of();
            result.summary = "无变更";
            return result;
        }

        // Compare union of keys
        Set<String> allKeys = new LinkedHashSet<>(beforeJson.keySet());
        allKeys.addAll(afterJson.keySet());

        List<String> changedKeys = new ArrayList<>();
        for (String key : allKeys) {
            Object beforeVal = beforeJson.get(key);
            Object afterVal = afterJson.get(key);
            if (!Objects.equals(beforeVal, afterVal)) {
                changedKeys.add(key);
            }
        }

        result.fields = changedKeys;

        if (changedKeys.isEmpty()) {
            result.summary = "无实质变更";
        } else if (changedKeys.size() <= 3) {
            result.summary = "修改了 " + changedKeys.size() + " 个字段: " + String.join(", ", changedKeys);
        } else {
            result.summary = "修改了 " + changedKeys.size() + " 个字段: "
                    + String.join(", ", changedKeys.subList(0, 3)) + " 等";
        }

        return result;
    }

    @Data
    public static class ChangedFieldsResult {
        public List<String> fields;
        public String summary;
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private ChangeHistoryV2VO toV2VO(AuditLog a, Map<Long, String> operatorNames) {
        ChangeHistoryV2VO vo = new ChangeHistoryV2VO();
        vo.setId(a.getId());
        vo.setAction(a.getAction());
        vo.setOperatorId(a.getOperatorId());
        vo.setOperatorName(operatorNames.getOrDefault(a.getOperatorId(), "系统"));
        vo.setBeforeJson(parseJson(a.getBeforeJson()));
        vo.setAfterJson(parseJson(a.getAfterJson()));
        vo.setCreatedAt(a.getCreatedAt());

        ChangedFieldsResult cfr = computeChangedFields(vo.getBeforeJson(), vo.getAfterJson());
        vo.setChangedFields(cfr.getFields());
        vo.setSummary(cfr.getSummary());

        return vo;
    }

    private boolean matchesModelId(ChangeHistoryV2VO vo, String modelId) {
        Map<String, Object> json = vo.getAfterJson() != null ? vo.getAfterJson() : vo.getBeforeJson();
        if (json == null) return false;
        Object mid = json.get("modelId");
        return modelId.equals(mid);
    }

    private ActionCountVO computeActionCounts(String tenantId, String from, String to, String modelId) {
        List<Map<String, Object>> rows = auditLogMapper.queryDailyBreakdown(tenantId, from, to, modelId);

        ActionCountVO counts = new ActionCountVO();
        for (Map<String, Object> row : rows) {
            String action = String.valueOf(row.get("action"));
            int cnt = ((Number) row.get("cnt")).intValue();
            switch (action) {
                case "create_instance" -> counts.setCreated(counts.getCreated() + cnt);
                case "update_instance" -> counts.setUpdated(counts.getUpdated() + cnt);
                case "delete_instance" -> counts.setDeleted(counts.getDeleted() + cnt);
            }
        }
        counts.setTotal(counts.getCreated() + counts.getUpdated() + counts.getDeleted());
        return counts;
    }

    private List<DailyCountVO> computeDailyBreakdown(String tenantId, String from, String to, String modelId) {
        List<Map<String, Object>> rows = auditLogMapper.queryDailyBreakdown(tenantId, from, to, modelId);

        // Group by date
        Map<String, DailyCountVO> dailyMap = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            String date = String.valueOf(row.get("dt"));
            String action = String.valueOf(row.get("action"));
            int cnt = ((Number) row.get("cnt")).intValue();

            DailyCountVO daily = dailyMap.computeIfAbsent(date, d -> {
                DailyCountVO dc = new DailyCountVO();
                dc.setDate(d);
                return dc;
            });

            switch (action) {
                case "create_instance" -> daily.setCreated(daily.getCreated() + cnt);
                case "update_instance" -> daily.setUpdated(daily.getUpdated() + cnt);
                case "delete_instance" -> daily.setDeleted(daily.getDeleted() + cnt);
            }
        }

        return new ArrayList<>(dailyMap.values());
    }

    private List<TopInstanceVO> computeTop10Instances(String tenantId, String fromDate, String modelId) {
        List<Map<String, Object>> rows = auditLogMapper.queryTopChangedInstances(tenantId, fromDate, modelId);

        List<TopInstanceVO> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Long targetId = ((Number) row.get("target_id")).longValue();
            int changeCount = ((Number) row.get("cnt")).intValue();

            TopInstanceVO vo = new TopInstanceVO();
            vo.setInstanceId(targetId);
            vo.setChangeCount(changeCount);

            // Resolve instance name and model
            CiInstance inst = ciInstanceMapper.selectById(targetId);
            if (inst != null) {
                vo.setInstanceName(inst.getName());
                vo.setModelId(inst.getModelId());
                ciModelMapper.findByName(inst.getModelId(), tenantId)
                        .ifPresent(m -> vo.setModelName(m.getDisplayName()));
            } else {
                vo.setInstanceName("已删除实例#" + targetId);
            }

            result.add(vo);
        }
        return result;
    }

    private String buildStatsCacheKey(String modelId, String from, String to) {
        String mid = (modelId != null) ? modelId : "_all";
        return STATS_CACHE_PREFIX + mid + ":" + from + ":" + to;
    }

    private Map<Long, String> resolveOperatorNames(List<AuditLog> records) {
        Set<Long> userIds = records.stream()
                .map(AuditLog::getOperatorId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());
        if (userIds.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId,
                        u -> u.getRealName() != null ? u.getRealName() : u.getUsername(),
                        (a, b) -> a));
    }

    private Map<String, Object> parseJson(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return null;
        }
    }
}
