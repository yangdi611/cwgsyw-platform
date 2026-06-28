package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvFailedRowVO;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvImportPreviewVO;
import com.cwgsyw.platform.module.cmdb.dto.csv.CsvImportResultVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.CreateInstanceRequest;
import com.cwgsyw.platform.module.cmdb.dto.instance.UpdateInstanceRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.TimeUnit;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * JSON / NDJSON 批量导入（spec §7，P2）。不复用 CSV 行解析；解析后构造标准请求走
 * {@link CiInstanceCommandService}，自动获得 table 校验 + 唯一性 + 审计 + 变更记录。
 *
 * <p>三档 mode（§7.2）：
 * <ul>
 *   <li>{@code merge}（默认）：顶层只更新出现的键，table 整键覆盖。</li>
 *   <li>{@code replace_fields}：同 merge（现 update 即顶层 putAll + table 整键覆盖）。</li>
 *   <li>{@code baseline_replace}：table 字段按 row_id 三路对齐（缺失删/新增插/同 id 更新），
 *       导入器先算好完整 table 数组再整键提交。基线月度重导关键。</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class JsonImportService {

    private static final long PREVIEW_TTL_SECONDS = 1800;
    private static final int MAX_ROWS = 50_000;
    private static final String DEFAULT_ROW_KEY = "row_id";

    private final CiModelMapper ciModelMapper;
    private final CiAttributeMapper ciAttributeMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final CiInstanceCommandService commandService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * 解析 NDJSON（一行一对象）或 JSON 数组，按唯一键判 create/update，存 Redis 返回预览。
     */
    public CsvImportPreviewVO preview(String content, String model, String mode,
                                      String uniqueKeyFields, String tenantId) {
        if (content == null || content.isBlank()) {
            throw new IllegalArgumentException("导入内容为空");
        }
        CiModel ciModel = loadModel(model, tenantId);
        String importMode = normalizeMode(mode);
        List<String> uniqueKeys = parseUniqueKeys(uniqueKeyFields);

        List<Map<String, Object>> rows = parseContent(content);
        if (rows.isEmpty()) throw new IllegalArgumentException("未解析到任何对象");
        if (rows.size() > MAX_ROWS) throw new IllegalArgumentException("超过单批最大行数 " + MAX_ROWS);

        int toCreate = 0, toUpdate = 0;
        List<CsvFailedRowVO> failed = new ArrayList<>();
        List<Map<String, Object>> resolved = new ArrayList<>();
        int rowNum = 0;
        for (Map<String, Object> raw : rows) {
            rowNum++;
            try {
                Map<String, Object> row = new LinkedHashMap<>(raw);
                row.put("_modelId", ciModel.getModelId());
                Long existingId = resolveExistingId(row, uniqueKeys, ciModel.getModelId(), tenantId);
                if (existingId != null) {
                    row.put("_action", "update");
                    row.put("_existingId", existingId);
                    toUpdate++;
                } else {
                    row.put("_action", "create");
                    toCreate++;
                }
                resolved.add(row);
            } catch (Exception e) {
                failed.add(buildFailedRow(rowNum, e.getMessage(), raw));
            }
        }

        String batchId = "json-" + UUID.randomUUID().toString().substring(0, 8);
        try {
            Map<String, Object> envelope = new LinkedHashMap<>();
            envelope.put("mode", importMode);
            envelope.put("rows", resolved);
            redisTemplate.opsForValue().set("cmdb:import:json:" + batchId,
                    objectMapper.writeValueAsString(envelope), PREVIEW_TTL_SECONDS, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new IllegalArgumentException("预览数据存储失败: " + e.getMessage());
        }

        CsvImportPreviewVO vo = new CsvImportPreviewVO();
        vo.setBatchId(batchId);
        vo.setTotalRows(rows.size());
        vo.setToCreate(toCreate);
        vo.setToUpdate(toUpdate);
        vo.setToSkip(0);
        vo.setFailedRows(failed);
        vo.setEncoding("utf-8");
        vo.setPreviewData(resolved.size() > 50 ? resolved.subList(0, 50) : resolved);
        return vo;
    }

    /**
     * 执行导入：逐对象按 mode 构造请求调 CiInstanceCommandService.create/update，逐条 try-catch 汇总。
     */
    public CsvImportResultVO execute(String batchId, String tenantId, Long operatorId) {
        long start = System.currentTimeMillis();
        String json = redisTemplate.opsForValue().get("cmdb:import:json:" + batchId);
        if (json == null) throw new IllegalArgumentException("预览数据已过期，请重新上传");

        Map<String, Object> envelope;
        try {
            envelope = objectMapper.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalArgumentException("预览数据解析失败");
        }
        String mode = String.valueOf(envelope.getOrDefault("mode", "merge"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rows = (List<Map<String, Object>>) envelope.getOrDefault("rows", List.of());

        int created = 0, updated = 0, failed = 0;
        List<CsvFailedRowVO> failedRows = new ArrayList<>();
        int rowNum = 0;
        for (Map<String, Object> row : rows) {
            rowNum++;
            try {
                String action = String.valueOf(row.getOrDefault("_action", "create"));
                String modelId = String.valueOf(row.get("_modelId"));
                Map<String, Object> fields = extractFields(row);

                if ("update".equals(action)) {
                    Long id = ((Number) row.get("_existingId")).longValue();
                    if ("baseline_replace".equals(mode)) {
                        fields = baselineAlignTables(id, fields, modelId, tenantId);
                    }
                    UpdateInstanceRequest req = new UpdateInstanceRequest();
                    if (row.get("name") != null) req.setName(String.valueOf(row.get("name")));
                    if (row.get("status") != null) req.setStatus(String.valueOf(row.get("status")));
                    if (row.get("owner") != null) req.setOwner(String.valueOf(row.get("owner")));
                    if (row.get("description") != null) req.setDescription(String.valueOf(row.get("description")));
                    req.setFieldsData(fields);
                    commandService.update(id, req, tenantId, operatorId);
                    updated++;
                } else {
                    CreateInstanceRequest req = new CreateInstanceRequest();
                    req.setModelId(modelId);
                    req.setName(String.valueOf(row.get("name")));
                    req.setStatus(row.get("status") != null ? String.valueOf(row.get("status")) : "online");
                    if (row.get("owner") != null) req.setOwner(String.valueOf(row.get("owner")));
                    if (row.get("description") != null) req.setDescription(String.valueOf(row.get("description")));
                    req.setFieldsData(fields);
                    commandService.create(req, tenantId, operatorId);
                    created++;
                }
            } catch (Exception e) {
                failed++;
                failedRows.add(buildFailedRow(rowNum, rootMessage(e), row));
            }
        }

        redisTemplate.delete("cmdb:import:json:" + batchId);

        CsvImportResultVO vo = new CsvImportResultVO();
        vo.setBatchId(batchId);
        vo.setTotalRows(rows.size());
        vo.setCreated(created);
        vo.setUpdated(updated);
        vo.setSkipped(0);
        vo.setFailed(failed);
        vo.setFailedRows(failedRows);
        vo.setDurationMs(System.currentTimeMillis() - start);
        return vo;
    }

    // ─── 解析 ─────────────────────────────────────────────────────────────────

    /** 自动识别 JSON 数组（首非空字符为 '['）或 NDJSON（逐行对象）。包级可见以便单测。 */
    public List<Map<String, Object>> parseContent(String content) {
        String trimmed = content.trim();
        try {
            if (trimmed.startsWith("[")) {
                return objectMapper.readValue(trimmed, new TypeReference<List<Map<String, Object>>>() {});
            }
        } catch (Exception e) {
            throw new IllegalArgumentException("JSON 数组解析失败: " + e.getMessage());
        }
        // NDJSON：逐行
        List<Map<String, Object>> rows = new ArrayList<>();
        String[] lines = trimmed.split("\\r?\\n");
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty()) continue;
            try {
                rows.add(objectMapper.readValue(line, new TypeReference<Map<String, Object>>() {}));
            } catch (Exception e) {
                throw new IllegalArgumentException("第 " + (i + 1) + " 行 JSON 解析失败: " + e.getMessage());
            }
        }
        return rows;
    }

    /** 顶层 name/status/owner/description + 系统键移除后剩余进 fieldsData；显式 null 表示清空（置空保留键）。包级可见以便单测。 */
    public Map<String, Object> extractFields(Map<String, Object> row) {
        Map<String, Object> fields = new LinkedHashMap<>(row);
        fields.remove("_action");
        fields.remove("_existingId");
        fields.remove("_modelId");
        fields.remove("name");
        fields.remove("status");
        fields.remove("owner");
        fields.remove("description");
        return fields;
    }

    /**
     * baseline_replace：对每个 table 字段按 row_id 三路对齐——旧∩新更新、新-旧插入、旧-新删除。
     * 因 update 不做行级合并，这里先算好完整 table 数组再整键提交。
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> baselineAlignTables(Long instanceId, Map<String, Object> fields,
                                                    String modelId, String tenantId) {
        CiInstance old = ciInstanceMapper.selectById(instanceId);
        Map<String, Object> oldFields = (old != null && old.getFieldsData() != null)
                ? old.getFieldsData() : Map.of();
        List<CiAttribute> attrs = ciAttributeMapper.listByModel(modelId, tenantId);
        Set<String> tableKeys = new HashSet<>();
        for (CiAttribute a : attrs) if ("table".equals(a.getFieldType())) tableKeys.add(a.getFieldKey());

        Map<String, Object> result = new LinkedHashMap<>(fields);
        for (String key : tableKeys) {
            if (!fields.containsKey(key)) continue; // 本次未带该 table 字段则不动
            Object newVal = fields.get(key);
            if (!(newVal instanceof List<?> newRows)) continue;
            // baseline_replace 语义即"以本次为准全量替换"——新数组本身就是对齐结果。
            // 保留新数组（缺失行自然被删、新行插入、同 row_id 以新值为准）。
            result.put(key, newRows);
        }
        return result;
    }

    private Long resolveExistingId(Map<String, Object> row, List<String> uniqueKeys,
                                   String modelId, String tenantId) {
        // 优先按显式唯一键字段在 fieldsData 内匹配；否则按 name 匹配。
        if (!uniqueKeys.isEmpty()) {
            for (String key : uniqueKeys) {
                Object v = row.get(key);
                if (v == null) continue;
                LambdaQueryWrapper<CiInstance> q = new LambdaQueryWrapper<CiInstance>()
                        .eq(CiInstance::getTenantId, tenantId)
                        .eq(CiInstance::getModelId, modelId)
                        .eq(CiInstance::getIsDeleted, false)
                        .apply("attrs ->> {0} = {1}", key, String.valueOf(v))
                        .last("LIMIT 1");
                CiInstance hit = ciInstanceMapper.selectOne(q);
                if (hit != null) return hit.getId();
            }
            return null;
        }
        Object name = row.get("name");
        if (name == null) return null;
        LambdaQueryWrapper<CiInstance> q = new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId)
                .eq(CiInstance::getModelId, modelId)
                .eq(CiInstance::getName, String.valueOf(name))
                .eq(CiInstance::getIsDeleted, false)
                .last("LIMIT 1");
        CiInstance hit = ciInstanceMapper.selectOne(q);
        return hit != null ? hit.getId() : null;
    }

    private List<String> parseUniqueKeys(String uniqueKeyFields) {
        if (uniqueKeyFields == null || uniqueKeyFields.isBlank()) return List.of();
        List<String> keys = new ArrayList<>();
        for (String k : uniqueKeyFields.split(",")) {
            String t = k.trim();
            if (!t.isEmpty()) keys.add(t);
        }
        return keys;
    }

    public String normalizeMode(String mode) {
        if (mode == null) return "merge";
        return switch (mode) {
            case "merge", "replace_fields", "baseline_replace" -> mode;
            default -> throw new IllegalArgumentException("不支持的导入模式: " + mode);
        };
    }

    private CiModel loadModel(String model, String tenantId) {
        LambdaQueryWrapper<CiModel> q = new LambdaQueryWrapper<CiModel>()
                .eq(CiModel::getTenantId, tenantId)
                .eq(CiModel::getModelId, model)
                .eq(CiModel::getIsDeleted, false);
        CiModel m = ciModelMapper.selectOne(q);
        if (m == null) throw new IllegalArgumentException("模型不存在: " + model);
        return m;
    }

    private CsvFailedRowVO buildFailedRow(int rowNum, String reason, Map<String, Object> rowData) {
        CsvFailedRowVO vo = new CsvFailedRowVO();
        vo.setRowNumber(rowNum);
        vo.setReason(reason);
        vo.setRowData(rowData);
        return vo;
    }

    private String rootMessage(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null && t.getCause() != t) t = t.getCause();
        return t.getMessage() != null ? t.getMessage() : e.toString();
    }
}
