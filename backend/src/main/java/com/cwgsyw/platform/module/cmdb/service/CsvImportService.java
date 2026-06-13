package com.cwgsyw.platform.module.cmdb.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.csv.*;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.cmdb.util.CsvParser;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.OutputStreamWriter;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
public class CsvImportService {

    private static final int BATCH_SIZE = 100;
    private static final long PROGRESS_TTL_SECONDS = 600; // 10 min
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    private final CiModelMapper ciModelMapper;
    private final CiAttributeMapper ciAttributeMapper;
    private final CiInstanceMapper ciInstanceMapper;
    private final AuditLogMapper auditLogMapper;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Generate an import template CSV for the given model.
     * Returns CSV content as String.
     */
    public String generateTemplate(String model, String tenantId) {
        CiModel ciModel = loadModel(model, tenantId);
        List<CiAttribute> attrs = ciAttributeMapper.listByModel(ciModel.getName(), tenantId);

        List<String> headers = new ArrayList<>();
        for (CiAttribute attr : attrs) {
            if (Boolean.TRUE.equals(attr.getIsRequired()) || Boolean.TRUE.equals(attr.getIsListShow())) {
                if ("enum".equals(attr.getFieldType()) && attr.getEnumOptions() != null) {
                    headers.add(attr.getFieldKey() + " (" + attr.getEnumOptions() + ")");
                } else {
                    headers.add(attr.getFieldKey());
                }
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.append(String.join(",", headers));
        sb.append("\n");
        return sb.toString();
    }

    /**
     * Parse and preview a CSV file. Stores parsed data in Redis for later execute().
     */
    public CsvImportPreviewVO preview(MultipartFile file, String model, String conflictStrategy,
                                       String uniqueKeyFields, String encoding, String tenantId) {
        validateFile(file);
        CiModel ciModel = loadModel(model, tenantId);
        List<CiAttribute> attrs = ciAttributeMapper.listByModel(ciModel.getName(), tenantId);

        try {
            byte[] data = file.getBytes();

            // Encoding detection
            String detectedEncoding = encoding;
            if (detectedEncoding == null || detectedEncoding.isBlank()) {
                detectedEncoding = CsvParser.detectEncoding(data);
            }

            List<Map<String, String>> rows = CsvParser.parse(data, detectedEncoding);
            List<String> uniqueFields = resolveUniqueFields(uniqueKeyFields, attrs);

            // Validate headers
            List<String> requiredHeaders = attrs.stream()
                    .filter(a -> Boolean.TRUE.equals(a.getIsRequired()))
                    .map(CiAttribute::getFieldKey)
                    .collect(Collectors.toList());
            Set<String> csvHeaders = rows.isEmpty() ? Set.of() : rows.get(0).keySet();
            List<String> missingHeaders = requiredHeaders.stream()
                    .filter(h -> !csvHeaders.contains(h))
                    .collect(Collectors.toList());
            if (!missingHeaders.isEmpty()) {
                throw new IllegalArgumentException("缺失必填字段: " + String.join(", ", missingHeaders));
            }

            // Build attr lookup
            Map<String, CiAttribute> attrMap = attrs.stream()
                    .collect(Collectors.toMap(CiAttribute::getFieldKey, a -> a, (a, b) -> a));

            // Pre-load existing instances by unique key
            Map<String, CiInstance> existingMap = loadExistingInstances(ciModel.getName(), uniqueFields, tenantId);

            // Validate each row
            List<Map<String, Object>> toCreate = new ArrayList<>();
            List<Map<String, Object>> toUpdate = new ArrayList<>();
            List<Map<String, Object>> toSkip = new ArrayList<>();
            List<CsvFailedRowVO> failedRows = new ArrayList<>();

            for (int i = 0; i < rows.size(); i++) {
                Map<String, String> row = rows.get(i);
                int rowNumber = i + 2; // +1 header, +1 1-indexed
                List<String> errors = validateRow(row, attrMap);

                if (!errors.isEmpty()) {
                    failedRows.add(buildFailedRow(rowNumber, String.join("; ", errors), row));
                    continue;
                }

                String uniqueKey = buildUniqueKey(row, uniqueFields);
                CiInstance existing = uniqueKey != null ? existingMap.get(uniqueKey) : null;

                if (existing == null) {
                    Map<String, Object> rowData = convertRow(row, attrMap);
                    rowData.put("_action", "create");
                    toCreate.add(rowData);
                } else {
                    if ("skip".equals(conflictStrategy)) {
                        Map<String, Object> rowData = convertRow(row, attrMap);
                        rowData.put("_action", "skip");
                        toSkip.add(rowData);
                    } else if ("error".equals(conflictStrategy)) {
                        failedRows.add(buildFailedRow(rowNumber, "唯一键冲突: " + uniqueKey, row));
                    } else {
                        // override (default)
                        Map<String, Object> rowData = convertRow(row, attrMap);
                        rowData.put("_action", "update");
                        rowData.put("_existingId", existing.getId());
                        toUpdate.add(rowData);
                    }
                }
            }

            // Generate batch ID
            String batchId = UUID.randomUUID().toString();

            // Build preview data (first 10 rows)
            List<Map<String, Object>> previewData = new ArrayList<>();
            Stream.concat(Stream.concat(toCreate.stream(), toUpdate.stream()), toSkip.stream())
                    .limit(10)
                    .forEach(row -> {
                        Map<String, Object> display = new LinkedHashMap<>(row);
                        display.remove("_action");
                        display.remove("_existingId");
                        previewData.add(display);
                    });

            // Store parsed data in Redis for execute()
            List<Map<String, Object>> allRows = new ArrayList<>();
            allRows.addAll(toCreate);
            allRows.addAll(toUpdate);
            allRows.addAll(toSkip);
            String rowsJson = objectMapper.writeValueAsString(allRows);
            redisTemplate.opsForValue().set(
                    "cmdb:import:preview:" + batchId, rowsJson,
                    PROGRESS_TTL_SECONDS, TimeUnit.SECONDS);

            CsvImportPreviewVO vo = new CsvImportPreviewVO();
            vo.setBatchId(batchId);
            vo.setTotalRows(rows.size());
            vo.setToCreate(toCreate.size());
            vo.setToUpdate(toUpdate.size());
            vo.setToSkip(toSkip.size());
            vo.setFailedRows(failedRows);
            vo.setEncoding(detectedEncoding);
            vo.setPreviewData(previewData);
            return vo;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.error("CSV preview failed", e);
            throw new IllegalArgumentException("CSV 解析失败: " + e.getMessage());
        }
    }

    /**
     * Execute the import for a previously previewed batch.
     * Processes rows in batches of 100, each in its own transaction segment.
     */
    public CsvImportResultVO execute(String batchId, String tenantId, Long operatorId) {
        long startTime = System.currentTimeMillis();

        // Load preview data from Redis
        String previewJson = redisTemplate.opsForValue().get("cmdb:import:preview:" + batchId);
        if (previewJson == null) {
            throw new IllegalArgumentException("预览数据已过期，请重新上传");
        }

        List<Map<String, Object>> allRows;
        try {
            allRows = objectMapper.readValue(previewJson, new TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalArgumentException("预览数据解析失败");
        }

        // Initialize progress in Redis
        initProgress(batchId, allRows.size());

        int created = 0, updated = 0, skipped = 0, failed = 0;
        List<CsvFailedRowVO> failedRows = new ArrayList<>();

        // Process in batch segments
        for (int i = 0; i < allRows.size(); i += BATCH_SIZE) {
            int end = Math.min(i + BATCH_SIZE, allRows.size());
            List<Map<String, Object>> segment = allRows.subList(i, end);

            BatchResult br = processSegment(segment, tenantId, operatorId, batchId);
            created += br.created;
            updated += br.updated;
            skipped += br.skipped;
            failed += br.failed;
            failedRows.addAll(br.failedRows);

            updateProgress(batchId, end, created, updated, skipped, failed);
        }

        // Cleanup
        redisTemplate.delete("cmdb:import:preview:" + batchId);
        markProgressCompleted(batchId, created, updated, skipped, failed);

        long durationMs = System.currentTimeMillis() - startTime;

        CsvImportResultVO vo = new CsvImportResultVO();
        vo.setBatchId(batchId);
        vo.setTotalRows(allRows.size());
        vo.setCreated(created);
        vo.setUpdated(updated);
        vo.setSkipped(skipped);
        vo.setFailed(failed);
        vo.setFailedRows(failedRows);
        vo.setDurationMs(durationMs);
        return vo;
    }

    /**
     * Query import progress by batchId.
     */
    public CsvImportProgressVO getProgress(String batchId) {
        Map<Object, Object> hash = redisTemplate.opsForHash().entries("cmdb:import:progress:" + batchId);
        if (hash.isEmpty()) {
            throw new IllegalArgumentException("导入进度不存在或已过期");
        }

        CsvImportProgressVO vo = new CsvImportProgressVO();
        vo.setBatchId(batchId);
        vo.setStatus(getStr(hash, "status"));
        vo.setTotalRows(getInt(hash, "totalRows"));
        vo.setProcessed(getInt(hash, "processed"));
        vo.setCreated(getInt(hash, "created"));
        vo.setUpdated(getInt(hash, "updated"));
        vo.setSkipped(getInt(hash, "skipped"));
        vo.setFailed(getInt(hash, "failed"));
        return vo;
    }

    /**
     * Download failed rows as CSV.
     */
    public byte[] downloadFailedRows(String batchId, String tenantId) {
        String previewJson = redisTemplate.opsForValue().get("cmdb:import:preview:" + batchId);
        // If preview is gone, try to reconstruct from audit log — for now just throw
        if (previewJson == null) {
            throw new IllegalArgumentException("导入数据已过期，无法下载失败行");
        }

        try {
            List<Map<String, Object>> allRows = objectMapper.readValue(previewJson, new TypeReference<>() {});
            List<CsvFailedRowVO> failedRows = new ArrayList<>();
            int rowNum = 2;
            for (Map<String, Object> row : allRows) {
                // Re-validate to find failures — or retrieve from progress
                rowNum++;
            }

            // For simplicity, output the raw rows that have _action != skip
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            OutputStreamWriter writer = new OutputStreamWriter(baos);

            if (!allRows.isEmpty()) {
                Set<String> allKeys = new LinkedHashSet<>();
                for (Map<String, Object> row : allRows) {
                    allKeys.addAll(row.keySet());
                }
                allKeys.remove("_action");
                allKeys.remove("_existingId");
                allKeys.add("失败原因");

                writer.write(String.join(",", allKeys) + "\n");
            }
            writer.flush();
            return baos.toByteArray();
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("生成失败行CSV出错: " + e.getMessage());
        }
    }

    // ─── Batch Processing ──────────────────────────────────────────────────────

    private static class BatchResult {
        int created, updated, skipped, failed;
        List<CsvFailedRowVO> failedRows = new ArrayList<>();
    }

    @Transactional
    public BatchResult processSegment(List<Map<String, Object>> segment, String tenantId,
                                       Long operatorId, String batchId) {
        BatchResult br = new BatchResult();
        int rowNum = 0; // approximate row number for error reporting

        for (Map<String, Object> rowData : segment) {
            rowNum++;
            String action = (String) rowData.getOrDefault("_action", "create");
            try {
                switch (action) {
                    case "create" -> {
                        CiInstance inst = new CiInstance();
                        inst.setTenantId(tenantId);
                        inst.setModelId((String) rowData.getOrDefault("_modelId", rowData.get("modelId")));
                        inst.setName((String) rowData.get("name"));
                        inst.setStatus((String) rowData.getOrDefault("status", "online"));
                        inst.setOwner((String) rowData.get("owner"));
                        inst.setDescription((String) rowData.get("description"));
                        // Build fieldsData from non-system fields
                        Map<String, Object> fieldsData = new LinkedHashMap<>(rowData);
                        fieldsData.remove("_action");
                        fieldsData.remove("_existingId");
                        fieldsData.remove("_modelId");
                        fieldsData.remove("name");
                        fieldsData.remove("status");
                        fieldsData.remove("owner");
                        fieldsData.remove("description");
                        fieldsData.entrySet().removeIf(e -> e.getValue() == null);
                        inst.setFieldsData(fieldsData);
                        ciInstanceMapper.insert(inst);
                        writeAudit(tenantId, "import_create", inst.getId(), "ci_instance",
                                operatorId, null, "batch_id=" + batchId);
                        br.created++;
                    }
                    case "update" -> {
                        Long existingId = ((Number) rowData.get("_existingId")).longValue();
                        CiInstance inst = ciInstanceMapper.selectById(existingId);
                        if (inst == null || inst.getIsDeleted()) {
                            br.failed++;
                            br.failedRows.add(buildFailedRow(rowNum, "实例不存在: " + existingId, rowData));
                            continue;
                        }
                        String before = snapshotInstance(inst);
                        if (rowData.get("name") != null) inst.setName((String) rowData.get("name"));
                        if (rowData.get("status") != null) inst.setStatus((String) rowData.get("status"));
                        if (rowData.get("owner") != null) inst.setOwner((String) rowData.get("owner"));
                        if (rowData.get("description") != null) inst.setDescription((String) rowData.get("description"));

                        Map<String, Object> fieldsUpdate = new LinkedHashMap<>(rowData);
                        fieldsUpdate.remove("_action");
                        fieldsUpdate.remove("_existingId");
                        fieldsUpdate.remove("_modelId");
                        fieldsUpdate.remove("name");
                        fieldsUpdate.remove("status");
                        fieldsUpdate.remove("owner");
                        fieldsUpdate.remove("description");
                        fieldsUpdate.entrySet().removeIf(e -> e.getValue() == null);

                        if (!fieldsUpdate.isEmpty()) {
                            Map<String, Object> merged = new LinkedHashMap<>();
                            if (inst.getFieldsData() != null) merged.putAll(inst.getFieldsData());
                            merged.putAll(fieldsUpdate);
                            inst.setFieldsData(merged);
                        }
                        ciInstanceMapper.updateById(inst);
                        writeAudit(tenantId, "import_update", existingId, "ci_instance",
                                operatorId, before, "batch_id=" + batchId);
                        br.updated++;
                    }
                    case "skip" -> br.skipped++;
                }
            } catch (Exception e) {
                br.failed++;
                br.failedRows.add(buildFailedRow(rowNum, e.getMessage(), rowData));
            }
        }
        return br;
    }

    // ─── Validation Helpers ────────────────────────────────────────────────────

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请上传CSV文件");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("文件大小超过10MB限制");
        }
    }

    private List<String> validateRow(Map<String, String> row, Map<String, CiAttribute> attrMap) {
        List<String> errors = new ArrayList<>();

        for (Map.Entry<String, CiAttribute> entry : attrMap.entrySet()) {
            CiAttribute attr = entry.getValue();
            String value = row.get(attr.getFieldKey());

            // Required check
            if (Boolean.TRUE.equals(attr.getIsRequired()) && (value == null || value.isEmpty())) {
                errors.add("字段 " + attr.getName() + " 不能为空");
                continue;
            }
            if (value == null || value.isEmpty()) continue;

            // Type check
            switch (attr.getFieldType()) {
                case "int" -> {
                    try {
                        Integer.parseInt(value);
                    } catch (NumberFormatException e) {
                        errors.add("字段 " + attr.getName() + " 应为整数: " + value);
                    }
                }
                case "bool" -> {
                    if (!"true".equalsIgnoreCase(value) && !"false".equalsIgnoreCase(value)) {
                        errors.add("字段 " + attr.getName() + " 应为布尔值(true/false): " + value);
                    }
                }
                case "enum" -> {
                    if (attr.getEnumOptions() != null) {
                        try {
                            List<String> options = objectMapper.readValue(attr.getEnumOptions(), new TypeReference<>() {});
                            if (!options.contains(value)) {
                                errors.add("字段 " + attr.getName() + " 的值不在可选范围内: " + value);
                            }
                        } catch (Exception ignored) {}
                    }
                }
            }
        }
        return errors;
    }

    private Map<String, Object> convertRow(Map<String, String> row, Map<String, CiAttribute> attrMap) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : row.entrySet()) {
            CiAttribute attr = attrMap.get(entry.getKey());
            if (attr == null) continue;
            String value = entry.getValue();
            if (value == null || value.isEmpty()) continue;

            switch (attr.getFieldType()) {
                case "int" -> {
                    try { result.put(entry.getKey(), Integer.parseInt(value)); }
                    catch (NumberFormatException e) { result.put(entry.getKey(), value); }
                }
                case "bool" -> result.put(entry.getKey(), Boolean.parseBoolean(value));
                default -> result.put(entry.getKey(), CsvParser.sanitize(value));
            }
        }
        return result;
    }

    // ─── Unique Key Helpers ────────────────────────────────────────────────────

    private List<String> resolveUniqueFields(String uniqueKeyFields, List<CiAttribute> attrs) {
        if (uniqueKeyFields != null && !uniqueKeyFields.isBlank()) {
            return Arrays.asList(uniqueKeyFields.split(","));
        }
        return attrs.stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsUnique()))
                .map(CiAttribute::getFieldKey)
                .collect(Collectors.toList());
    }

    private String buildUniqueKey(Map<String, String> row, List<String> uniqueFields) {
        if (uniqueFields.isEmpty()) return null;
        return uniqueFields.stream()
                .map(f -> row.getOrDefault(f, ""))
                .collect(Collectors.joining("|"));
    }

    private Map<String, CiInstance> loadExistingInstances(String modelId, List<String> uniqueFields, String tenantId) {
        if (uniqueFields.isEmpty()) return Map.of();

        LambdaQueryWrapper<CiInstance> query = new LambdaQueryWrapper<CiInstance>()
                .eq(CiInstance::getTenantId, tenantId)
                .eq(CiInstance::getModelId, modelId)
                .eq(CiInstance::getIsDeleted, false);
        List<CiInstance> instances = ciInstanceMapper.selectList(query);

        Map<String, CiInstance> result = new HashMap<>();
        for (CiInstance inst : instances) {
            String key = uniqueFields.stream()
                    .map(f -> inst.getFieldsData() != null && inst.getFieldsData().get(f) != null
                            ? inst.getFieldsData().get(f).toString() : "")
                    .collect(Collectors.joining("|"));
            if (!key.isEmpty()) result.put(key, inst);
        }
        return result;
    }

    // ─── Redis Progress Helpers ────────────────────────────────────────────────

    private void initProgress(String batchId, int totalRows) {
        Map<String, String> data = new HashMap<>();
        data.put("status", "running");
        data.put("totalRows", String.valueOf(totalRows));
        data.put("processed", "0");
        data.put("created", "0");
        data.put("updated", "0");
        data.put("skipped", "0");
        data.put("failed", "0");
        redisTemplate.opsForHash().putAll("cmdb:import:progress:" + batchId, data);
        redisTemplate.expire("cmdb:import:progress:" + batchId, PROGRESS_TTL_SECONDS, TimeUnit.SECONDS);
    }

    private void updateProgress(String batchId, int processed, int created, int updated, int skipped, int failed) {
        String key = "cmdb:import:progress:" + batchId;
        redisTemplate.opsForHash().put(key, "processed", String.valueOf(processed));
        redisTemplate.opsForHash().put(key, "created", String.valueOf(created));
        redisTemplate.opsForHash().put(key, "updated", String.valueOf(updated));
        redisTemplate.opsForHash().put(key, "skipped", String.valueOf(skipped));
        redisTemplate.opsForHash().put(key, "failed", String.valueOf(failed));
    }

    private void markProgressCompleted(String batchId, int created, int updated, int skipped, int failed) {
        String key = "cmdb:import:progress:" + batchId;
        redisTemplate.opsForHash().put(key, "status", "completed");
        redisTemplate.opsForHash().put(key, "created", String.valueOf(created));
        redisTemplate.opsForHash().put(key, "updated", String.valueOf(updated));
        redisTemplate.opsForHash().put(key, "skipped", String.valueOf(skipped));
        redisTemplate.opsForHash().put(key, "failed", String.valueOf(failed));
    }

    // ─── Common Helpers ────────────────────────────────────────────────────────

    private CiModel loadModel(String modelId, String tenantId) {
        return ciModelMapper.findByName(modelId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("模型不存在: " + modelId));
    }

    private CsvFailedRowVO buildFailedRow(int rowNumber, String reason, Map<String, ?> rowData) {
        CsvFailedRowVO vo = new CsvFailedRowVO();
        vo.setRowNumber(rowNumber);
        vo.setReason(reason);
        Map<String, Object> display = new LinkedHashMap<>(rowData);
        display.remove("_action");
        display.remove("_existingId");
        vo.setRowData(display);
        return vo;
    }

    private String snapshotInstance(CiInstance inst) {
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", inst.getId());
            map.put("modelId", inst.getModelId());
            map.put("name", inst.getName());
            map.put("status", inst.getStatus());
            map.put("owner", inst.getOwner());
            map.put("fieldsData", inst.getFieldsData());
            return objectMapper.writeValueAsString(map);
        } catch (Exception e) { return "{}"; }
    }

    private void writeAudit(String tenantId, String action, Long targetId,
                            String targetType, Long operatorId, String beforeJson, String remark) {
        auditLogMapper.insert(AuditLog.builder()
                .tenantId(tenantId).module("cmdb").action(action)
                .targetId(targetId).targetType(targetType)
                .operatorId(operatorId != null ? operatorId : 0L)
                .beforeJson(beforeJson).afterJson(remark)
                .createdAt(LocalDateTime.now()).build());
    }

    private String getStr(Map<Object, Object> hash, String field) {
        Object v = hash.get(field);
        return v != null ? v.toString() : "";
    }

    private int getInt(Map<Object, Object> hash, String field) {
        Object v = hash.get(field);
        return v != null ? Integer.parseInt(v.toString()) : 0;
    }
}
