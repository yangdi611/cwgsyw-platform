package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.cmdb.dto.changes.*;
import com.cwgsyw.platform.module.cmdb.entity.CiChangeRecord;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiChangeRecordMapper;
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

    private final CiChangeRecordMapper ciChangeRecordMapper;
    private final UserMapper userMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final CiModelMapper ciModelMapper;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    // ─── Instance History ────────────────────────────────────────────────────

    public PageResult<ChangeHistoryV2VO> getInstanceHistory(Long instanceId, String from, String to,
                                                             Long operatorId, String action,
                                                             int page, int size, String tenantId) {
        Page<CiChangeRecord> p = ciChangeRecordMapper.queryChanges(
                new Page<>(page, size), tenantId,
                List.of("ci_instance"), instanceId, mapActionToCanonical(action),
                operatorId, null, from, to);

        Map<Long, String> operatorNames = resolveOperatorNames(p.getRecords());
        List<ChangeHistoryV2VO> records = p.getRecords().stream()
                .map(r -> toV2VO(r, operatorNames))
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
        boolean isRelation = "ci_instance_rel".equals(entityType);
        List<String> targetTypes = isRelation ? List.of("ci_instance_rel") : List.of("ci_instance");

        // model_code filtering only applies to instance records (relations have no
        // single owning model in this view); it is now applied in SQL rather than
        // as a post-query Java stream filter, so the page total is accurate.
        String modelFilter = (modelId != null && !isRelation) ? modelId : null;

        Page<CiChangeRecord> p = ciChangeRecordMapper.queryChanges(
                new Page<>(page, size), tenantId,
                targetTypes, entityId, mapActionToCanonical(action),
                operatorId, modelFilter, from, to);

        Map<Long, String> operatorNames = resolveOperatorNames(p.getRecords());

        List<ChangeHistoryV2VO> records = p.getRecords().stream()
                .map(r -> toV2VO(r, operatorNames))
                .collect(Collectors.toList());

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

        // Top 10 instances — NOTE: original passed tenantId as the modelId arg; preserved verbatim for behaviour parity (Issue #64 AC6).
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

    // ─── Changed Fields Computation (static, retained for reconciliation) ────

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

    /**
     * Build a V2 change-history VO from a {@link CiChangeRecord}. The structured
     * {@code field_changes} diff is projected back into {@code beforeJson} /
     * {@code afterJson} maps (key present only when the side has a non-null
     * value) so the existing front-end {@code JsonDiffView} renders create /
     * update / delete rows as added / modified / removed respectively.
     */
    private ChangeHistoryV2VO toV2VO(CiChangeRecord r, Map<Long, String> operatorNames) {
        ChangeHistoryV2VO vo = new ChangeHistoryV2VO();
        vo.setId(r.getId());
        vo.setAction(mapActionToDisplay(r.getAction()));
        vo.setOperatorId(r.getOperatorId());
        vo.setOperatorName(operatorNames.getOrDefault(r.getOperatorId(), "系统"));
        vo.setCreatedAt(r.getCreatedAt());

        Map<String, Object> beforeJson = new LinkedHashMap<>();
        Map<String, Object> afterJson = new LinkedHashMap<>();
        List<String> changedFields = new ArrayList<>();
        List<Map<String, Object>> fieldChanges = r.getFieldChanges();
        if (fieldChanges != null) {
            for (Map<String, Object> fc : fieldChanges) {
                Object fieldObj = fc.get("field");
                if (fieldObj == null) continue;
                String field = String.valueOf(fieldObj);
                Object before = fc.get("before");
                Object after = fc.get("after");
                changedFields.add(field);
                if (before != null) beforeJson.put(field, before);
                if (after != null) afterJson.put(field, after);
            }
        }
        vo.setBeforeJson(beforeJson.isEmpty() ? null : beforeJson);
        vo.setAfterJson(afterJson.isEmpty() ? null : afterJson);
        vo.setChangedFields(changedFields);
        vo.setSummary(buildSummary(r.getAction(), changedFields));

        return vo;
    }

    private String buildSummary(String action, List<String> changedFields) {
        if ("create".equals(action)) return "创建了实例";
        if ("delete".equals(action)) return "删除了实例";
        if (changedFields.isEmpty()) return "无实质变更";
        if (changedFields.size() <= 3) {
            return "修改了 " + changedFields.size() + " 个字段: " + String.join(", ", changedFields);
        }
        return "修改了 " + changedFields.size() + " 个字段: "
                + String.join(", ", changedFields.subList(0, 3)) + " 等";
    }

    private ActionCountVO computeActionCounts(String tenantId, String from, String to, String modelId) {
        List<Map<String, Object>> rows = ciChangeRecordMapper.queryDailyBreakdown(tenantId, from, to, modelId);

        ActionCountVO counts = new ActionCountVO();
        for (Map<String, Object> row : rows) {
            String action = String.valueOf(row.get("action"));
            int cnt = ((Number) row.get("cnt")).intValue();
            switch (action) {
                case "create" -> counts.setCreated(counts.getCreated() + cnt);
                case "update" -> counts.setUpdated(counts.getUpdated() + cnt);
                case "delete" -> counts.setDeleted(counts.getDeleted() + cnt);
            }
        }
        counts.setTotal(counts.getCreated() + counts.getUpdated() + counts.getDeleted());
        return counts;
    }

    private List<DailyCountVO> computeDailyBreakdown(String tenantId, String from, String to, String modelId) {
        List<Map<String, Object>> rows = ciChangeRecordMapper.queryDailyBreakdown(tenantId, from, to, modelId);

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
                case "create" -> daily.setCreated(daily.getCreated() + cnt);
                case "update" -> daily.setUpdated(daily.getUpdated() + cnt);
                case "delete" -> daily.setDeleted(daily.getDeleted() + cnt);
            }
        }

        return new ArrayList<>(dailyMap.values());
    }

    private List<TopInstanceVO> computeTop10Instances(String tenantId, String fromDate, String modelId) {
        List<Map<String, Object>> rows = ciChangeRecordMapper.queryTopChangedInstances(tenantId, fromDate, modelId);

        List<TopInstanceVO> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Long instanceId = ((Number) row.get("instance_id")).longValue();
            int changeCount = ((Number) row.get("cnt")).intValue();

            TopInstanceVO vo = new TopInstanceVO();
            vo.setInstanceId(instanceId);
            vo.setChangeCount(changeCount);

            // Resolve instance name and model
            CiInstance inst = ciInstanceMapper.selectById(instanceId);
            if (inst != null) {
                vo.setInstanceName(inst.getName());
                vo.setModelId(inst.getModelId());
                ciModelMapper.findByName(inst.getModelId(), tenantId)
                        .ifPresent(m -> vo.setModelName(m.getDisplayName()));
            } else {
                vo.setInstanceName("已删除实例#" + instanceId);
            }

            result.add(vo);
        }
        return result;
    }

    private String buildStatsCacheKey(String modelId, String from, String to) {
        String mid = (modelId != null) ? modelId : "_all";
        return STATS_CACHE_PREFIX + mid + ":" + from + ":" + to;
    }

    private Map<Long, String> resolveOperatorNames(List<CiChangeRecord> records) {
        Set<Long> userIds = records.stream()
                .map(CiChangeRecord::getOperatorId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toSet());
        if (userIds.isEmpty()) return Map.of();
        return userMapper.selectBatchIds(userIds).stream()
                .collect(Collectors.toMap(User::getId,
                        u -> u.getRealName() != null ? u.getRealName() : u.getUsername(),
                        (a, b) -> a));
    }

    /**
     * Map a legacy / front-end action filter value to the canonical
     * {@code ci_change_record.action}. Accepts both legacy
     * ({@code create_instance} …) and already-canonical values.
     */
    private static String mapActionToCanonical(String action) {
        if (action == null) return null;
        return switch (action) {
            case "create_instance", "create" -> "create";
            case "update_instance", "update" -> "update";
            case "delete_instance", "delete" -> "delete";
            case "create_relation", "update_relation", "delete_relation", "relate" -> "relate";
            default -> action;
        };
    }

    /**
     * Map a canonical {@code ci_change_record.action} back to the front-end-facing
     * value so existing UI badges / action filters keep working during the
     * dual-write period without a coordinated front-end change.
     */
    private static String mapActionToDisplay(String action) {
        if (action == null) return action;
        return switch (action) {
            case "create" -> "create_instance";
            case "update" -> "update_instance";
            case "delete" -> "delete_instance";
            case "relate" -> "create_relation";
            default -> action;
        };
    }
}
