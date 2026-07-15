package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocTemplate;
import lombok.RequiredArgsConstructor;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRow;

import java.io.InputStream;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChangeDocTemplateService {

    private final ChangeDocTemplateMapper templateMapper;
    private final ChangeDocFieldMapper fieldMapper;
    private final ChangeDocMapper changeDocMapper;
    private final AuditLogMapper auditLogMapper;
    private final MinioStorageService storage;
    private final TableFieldSupport tableFieldSupport;

    @Transactional
    public TemplateVO createTemplate(String tenantId, Long operatorId, String name, String description, String docType) {
        ChangeDocTemplate tpl = new ChangeDocTemplate();
        tpl.setTenantId(tenantId);
        tpl.setName(name);
        tpl.setDescription(description);
        tpl.setVersion(1);
        tpl.setIsActive(true);
        tpl.setDocType(normalizeDocType(docType));
        tpl.setCreatedAt(LocalDateTime.now());
        tpl.setUpdatedAt(LocalDateTime.now());
        templateMapper.insert(tpl);
        writeAudit(tenantId, "create_template", tpl.getId(), operatorId, "创建变更模板");
        return toTemplateVO(tpl, List.of());
    }

    @Transactional
    public TemplateVO cloneTemplate(String tenantId, Long operatorId, Long sourceId, String name) {
        ChangeDocTemplate source = getOrThrow(tenantId, sourceId);
        if (name == null || name.isBlank()) throw new IllegalArgumentException("模板名称不能为空");
        ChangeDocTemplate copy = new ChangeDocTemplate();
        copy.setTenantId(tenantId);
        copy.setName(name.trim());
        copy.setDescription(source.getDescription());
        copy.setVersion(1);
        copy.setIsActive(false);
        copy.setDocType(source.getDocType());
        copy.setCreatedAt(LocalDateTime.now());
        copy.setUpdatedAt(LocalDateTime.now());
        templateMapper.insert(copy);
        try {
            if (source.getDocxKey() != null && !source.getDocxKey().isBlank()) {
                String targetKey = "templates/" + tenantId + "/" + copy.getId() + "/v1.docx";
                storage.copyOrThrow(source.getDocxKey(), targetKey);
                copy.setDocxKey(targetKey);
                templateMapper.updateById(copy);
            }
            List<ChangeDocField> fields = fieldMapper.findByTemplate(sourceId);
            for (ChangeDocField sourceField : fields) {
                ChangeDocField field = new ChangeDocField();
                field.setTenantId(tenantId);
                field.setTemplateId(copy.getId());
                field.setFieldKey(sourceField.getFieldKey());
                field.setLabel(sourceField.getLabel());
                field.setFieldType(sourceField.getFieldType());
                field.setSortOrder(sourceField.getSortOrder());
                field.setRequired(sourceField.getRequired());
                field.setInForm(sourceField.getInForm());
                field.setPlaceholder(sourceField.getPlaceholder());
                field.setConfig(sourceField.getConfig() == null ? Map.of() : new LinkedHashMap<>(sourceField.getConfig()));
                fieldMapper.insert(field);
            }
        } catch (RuntimeException exception) {
            if (copy.getDocxKey() != null) storage.delete(copy.getDocxKey());
            throw exception;
        }
        writeAudit(tenantId, "clone_template", copy.getId(), operatorId, "复制自模板 " + sourceId);
        return toTemplateVO(copy, fieldMapper.findByTemplate(copy.getId()));
    }

    @Transactional
    public void deleteTemplate(String tenantId, Long operatorId, Long templateId) {
        ChangeDocTemplate template = getOrThrow(tenantId, templateId);
        if (changeDocMapper.countActiveReferences(tenantId, templateId) > 0) {
            throw new IllegalArgumentException("模板已被变更文档引用，不能删除");
        }
        fieldMapper.delete(new LambdaQueryWrapper<ChangeDocField>().eq(ChangeDocField::getTemplateId, templateId));
        templateMapper.deleteById(templateId);
        if (template.getDocxKey() != null && !template.getDocxKey().isBlank()) {
            storage.deleteOrThrow(template.getDocxKey());
        }
        writeAudit(tenantId, "delete_template", templateId, operatorId, "删除未引用变更模板及字段");
    }

    @Transactional
    public TemplateVO updateMeta(String tenantId, Long id, UpdateTemplateRequest req) {
        ChangeDocTemplate tpl = getOrThrow(tenantId, id);
        if (req.getName() != null && !req.getName().isBlank()) tpl.setName(req.getName());
        if (req.getDescription() != null) tpl.setDescription(req.getDescription());
        if (req.getDocType() != null) tpl.setDocType(normalizeDocType(req.getDocType()));
        tpl.setUpdatedAt(LocalDateTime.now());
        templateMapper.updateById(tpl);
        return toTemplateVO(tpl, fieldMapper.findByTemplate(id));
    }

    private String normalizeDocType(String dt) {
        if (dt == null) return "general";
        String v = dt.trim().toLowerCase();
        return switch (v) {
            case "application", "plan", "general" -> v;
            default -> "general";
        };
    }

    public List<TemplateVO> listTemplates(String tenantId, String docType) {
        return templateMapper.findByTenant(tenantId).stream()
                .filter(t -> docType == null || docType.isBlank()
                        || docType.equalsIgnoreCase(t.getDocType())
                        || ("application".equalsIgnoreCase(docType) && "general".equalsIgnoreCase(t.getDocType()))
                        || ("plan".equalsIgnoreCase(docType) && "general".equalsIgnoreCase(t.getDocType())))
                .map(t -> {
                    List<ChangeDocField> fields = fieldMapper.findByTemplate(t.getId());
                    return toTemplateVO(t, fields);
                }).collect(Collectors.toList());
    }

    public List<TemplateVO> listTemplates(String tenantId) {
        return listTemplates(tenantId, null);
    }

    public TemplateVO getTemplate(String tenantId, Long id) {
        ChangeDocTemplate tpl = getOrThrow(tenantId, id);
        return toTemplateVO(tpl, fieldMapper.findByTemplate(id));
    }

    public List<FieldConfigVO> getFields(Long templateId) {
        return fieldMapper.findByTemplate(templateId).stream()
                .map(this::toFieldVO).collect(Collectors.toList());
    }

    @Transactional
    public void uploadDocx(String tenantId, Long templateId, MultipartFile file) {
        ChangeDocTemplate tpl = getOrThrow(tenantId, templateId);
        String key = "templates/" + tenantId + "/" + templateId + "/v" + tpl.getVersion() + ".docx";
        try {
            storage.upload(key, file.getInputStream(), file.getSize(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
        } catch (Exception e) {
            throw new RuntimeException("上传模板文件失败: " + e.getMessage(), e);
        }
        templateMapper.update(null, new LambdaUpdateWrapper<ChangeDocTemplate>()
                .eq(ChangeDocTemplate::getId, templateId)
                .set(ChangeDocTemplate::getDocxKey, key)
                .set(ChangeDocTemplate::getUpdatedAt, LocalDateTime.now()));
    }

    /**
     * 解析 Word 模板占位符。
     * 见 SPEC §9：不含 "." 的占位符视为普通字段；表格数据行内含 "{{tableFieldKey.columnKey}}"
     * 的占位符按 tableFieldKey 分组识别为表格字段。同一行出现多个不同 tableFieldKey 时跳过，不自动建字段。
     */
    public List<String> parseBookmarks(String tenantId, Long templateId) {
        ChangeDocTemplate tpl = getOrThrow(tenantId, templateId);
        if (tpl.getDocxKey() == null) throw new IllegalStateException("请先上传模板文件");

        List<String> plainBookmarks = new ArrayList<>();
        // tableFieldKey -> 该表格在 Word 中出现过的 columnKey（保持出现顺序）
        Map<String, LinkedHashSet<String>> tableColumns = new LinkedHashMap<>();
        Pattern pattern = Pattern.compile("\\{\\{([^}]+)}}");

        try (InputStream in = storage.download(tpl.getDocxKey());
             XWPFDocument doc = new XWPFDocument(in)) {
            for (XWPFParagraph para : doc.getParagraphs()) {
                Matcher m = pattern.matcher(para.getText());
                while (m.find()) {
                    String key = m.group(1).trim();
                    if (!key.contains(".")) plainBookmarks.add(key);
                }
            }
            for (XWPFTable table : doc.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    List<String> rowPlaceholders = new ArrayList<>();
                    for (XWPFTableCell cell : row.getTableCells()) {
                        for (XWPFParagraph para : cell.getParagraphs()) {
                            Matcher m = pattern.matcher(para.getText());
                            while (m.find()) rowPlaceholders.add(m.group(1).trim());
                        }
                    }
                    Set<String> tableKeysInRow = new LinkedHashSet<>();
                    for (String ph : rowPlaceholders) {
                        if (ph.contains(".")) {
                            tableKeysInRow.add(ph.substring(0, ph.indexOf('.')));
                        } else {
                            plainBookmarks.add(ph);
                        }
                    }
                    if (tableKeysInRow.size() == 1) {
                        String tableKey = tableKeysInRow.iterator().next();
                        LinkedHashSet<String> cols = tableColumns.computeIfAbsent(tableKey, k -> new LinkedHashSet<>());
                        for (String ph : rowPlaceholders) {
                            if (ph.startsWith(tableKey + ".")) {
                                cols.add(ph.substring(tableKey.length() + 1));
                            }
                        }
                    }
                    // tableKeysInRow.size() > 1: 同一行出现多个不同表格字段，跳过，不自动建字段
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("解析模板书签失败: " + e.getMessage(), e);
        }

        List<ChangeDocField> existing = fieldMapper.findByTemplate(templateId);
        Map<String, ChangeDocField> existingByKey = new HashMap<>();
        for (ChangeDocField f : existing) existingByKey.put(f.getFieldKey(), f);
        int maxOrder = existing.stream().mapToInt(ChangeDocField::getSortOrder).max().orElse(0);

        for (String key : new LinkedHashSet<>(plainBookmarks)) {
            if (!existingByKey.containsKey(key)) {
                ChangeDocField f = new ChangeDocField();
                f.setTenantId(tenantId);
                f.setTemplateId(templateId);
                f.setFieldKey(key);
                f.setLabel(key);
                f.setFieldType("textarea");
                f.setSortOrder(++maxOrder);
                f.setRequired(false);
                f.setInForm(true);
                f.setConfig(Map.of());
                fieldMapper.insert(f);
                existingByKey.put(key, f);
            }
        }

        for (Map.Entry<String, LinkedHashSet<String>> e : tableColumns.entrySet()) {
            String tableKey = e.getKey();
            ChangeDocField field = existingByKey.get(tableKey);

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> existingColumns = field != null
                    && "table".equals(field.getFieldType())
                    && field.getConfig() != null
                    && field.getConfig().get("columns") instanceof List<?> l
                    ? (List<Map<String, Object>>) l.stream()
                        .filter(c -> c instanceof Map).collect(Collectors.toList())
                    : List.of();
            Set<String> existingColumnKeys = existingColumns.stream()
                    .map(c -> String.valueOf(c.get("key"))).collect(Collectors.toSet());

            List<Map<String, Object>> columns = new ArrayList<>(existingColumns);
            for (String colKey : e.getValue()) {
                if (existingColumnKeys.contains(colKey)) continue;
                Map<String, Object> col = new LinkedHashMap<>();
                col.put("key", colKey);
                col.put("label", colKey);
                col.put("type", "text");
                col.put("required", false);
                columns.add(col);
            }

            Map<String, Object> config;
            if (field != null && "table".equals(field.getFieldType()) && field.getConfig() != null) {
                config = new LinkedHashMap<>(field.getConfig());
            } else {
                config = new LinkedHashMap<>();
                config.put("tableMode", "fixedDocxTable");
                config.put("allowAddRow", true);
                config.put("allowDeleteRow", true);
                config.put("allowEditColumn", false);
                config.put("rowKey", "rowId");
            }
            config.put("columns", columns);

            if (field != null) {
                field.setFieldType("table");
                field.setConfig(config);
                fieldMapper.updateById(field);
            } else {
                ChangeDocField f = new ChangeDocField();
                f.setTenantId(tenantId);
                f.setTemplateId(templateId);
                f.setFieldKey(tableKey);
                f.setLabel(tableKey);
                f.setFieldType("table");
                f.setSortOrder(++maxOrder);
                f.setRequired(false);
                f.setInForm(true);
                f.setConfig(config);
                fieldMapper.insert(f);
                existingByKey.put(tableKey, f);
            }
        }

        List<String> result = new ArrayList<>(new LinkedHashSet<>(plainBookmarks));
        result.addAll(tableColumns.keySet());
        return result;
    }

    @Transactional
    public void saveFields(String tenantId, Long templateId, SaveFieldRequest req) {
        getOrThrow(tenantId, templateId);

        Set<String> seenKeys = new HashSet<>();
        for (SaveFieldRequest.FieldItem item : req.getFields()) {
            tableFieldSupport.validateFieldItem(item.getFieldKey(), item.getFieldType(), item.getConfig());
            if (!seenKeys.add(item.getFieldKey())) {
                throw new IllegalArgumentException("字段 key 不可重复: " + item.getFieldKey());
            }
        }

        for (SaveFieldRequest.FieldItem item : req.getFields()) {
            Map<String, Object> config = item.getConfig() == null ? Map.of() : item.getConfig();
            if (item.getId() != null && item.getId() > 0) {
                ChangeDocField f = fieldMapper.selectOne(new LambdaQueryWrapper<ChangeDocField>()
                        .eq(ChangeDocField::getId, item.getId())
                        .eq(ChangeDocField::getTemplateId, templateId));
                if (f == null) {
                    throw new IllegalArgumentException("字段不存在: " + item.getId());
                }
                f.setLabel(item.getLabel());
                f.setFieldType(item.getFieldType());
                f.setSortOrder(item.getSortOrder());
                f.setRequired(item.getRequired());
                f.setInForm(item.getInForm());
                f.setPlaceholder(item.getPlaceholder());
                f.setConfig(config);
                fieldMapper.updateById(f);
            } else {
                ChangeDocField f = new ChangeDocField();
                f.setTenantId(tenantId);
                f.setTemplateId(templateId);
                f.setFieldKey(item.getFieldKey());
                f.setLabel(item.getLabel());
                f.setFieldType(item.getFieldType() != null ? item.getFieldType() : "textarea");
                f.setSortOrder(item.getSortOrder() != null ? item.getSortOrder() : 0);
                f.setRequired(item.getRequired() != null ? item.getRequired() : false);
                f.setInForm(item.getInForm() != null ? item.getInForm() : true);
                f.setPlaceholder(item.getPlaceholder());
                f.setConfig(config);
                fieldMapper.insert(f);
            }
        }
    }

    @Transactional
    public void deleteField(Long fieldId) {
        fieldMapper.deleteById(fieldId);
    }

    @Transactional
    public void setActive(String tenantId, Long templateId, boolean active) {
        getOrThrow(tenantId, templateId);
        templateMapper.update(null, new LambdaUpdateWrapper<ChangeDocTemplate>()
                .eq(ChangeDocTemplate::getId, templateId)
                .set(ChangeDocTemplate::getIsActive, active)
                .set(ChangeDocTemplate::getUpdatedAt, LocalDateTime.now()));
    }

    /**
     * 填充 Word 模板。见 SPEC §10：先处理表格字段（复制/填充数据行），再处理普通占位符，
     * 最后处理页眉页脚。表格必须先处理，否则数据行模板里的 {{...}} 会被普通替换破坏。
     */
    public byte[] fillDocx(String tenantId, Long templateId, Map<String, Object> fieldsData) {
        ChangeDocTemplate tpl = getOrThrow(tenantId, templateId);
        if (tpl.getDocxKey() == null) throw new IllegalStateException("该模板尚未上传 Word 文件");
        Map<String, Object> data = fieldsData != null ? fieldsData : Map.of();
        List<ChangeDocField> fields = fieldMapper.findByTemplate(templateId);
        Map<String, ChangeDocField> tableFields = fields.stream()
                .filter(f -> "table".equals(f.getFieldType()))
                .collect(Collectors.toMap(ChangeDocField::getFieldKey, f -> f));

        try (InputStream in = storage.download(tpl.getDocxKey());
             XWPFDocument doc = new XWPFDocument(in);
             java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {

            for (XWPFTable table : doc.getTables()) {
                fillTable(table, tableFields, data);
            }

            Map<String, String> plainData = toPlainStringMap(data);
            replacePlaceholders(doc, plainData);
            assertNoUnresolvedTablePlaceholders(doc);
            doc.write(out);
            return out.toByteArray();
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("填充模板失败: " + e.getMessage(), e);
        }
    }

    /** 普通占位符值格式化：null→""，Boolean→是/否，表格数组/对象→"" 并记录日志（§10.8）。 */
    private Map<String, String> toPlainStringMap(Map<String, Object> data) {
        Map<String, String> plain = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : data.entrySet()) {
            Object v = e.getValue();
            String s;
            if (v == null) {
                s = "";
            } else if (v instanceof String str) {
                s = str;
            } else if (v instanceof Boolean b) {
                s = b ? "是" : "否";
            } else if (v instanceof List || v instanceof Map) {
                s = "";
            } else {
                s = v.toString();
            }
            plain.put(e.getKey(), s);
        }
        return plain;
    }

    private static final Pattern TABLE_PLACEHOLDER = Pattern.compile("\\{\\{([^.{}]+)\\.([^.{}]+)}}");

    /**
     * 在单个 Word 表格内识别并处理数据行模板。
     * 见 SPEC §10.3～§10.7：模板行按 tableFieldKey 分组，从后往前删除/插入，避免索引偏移。
     */
    private void fillTable(XWPFTable table, Map<String, ChangeDocField> tableFields, Map<String, Object> data) {
        List<XWPFTableRow> rows = table.getRows();
        // 依次处理每一个"模板行"，从最后一行往前扫描，避免删除/插入导致索引错位
        for (int rowIdx = rows.size() - 1; rowIdx >= 0; rowIdx--) {
            XWPFTableRow row = table.getRow(rowIdx);
            String tableFieldKey = detectTemplateRowFieldKey(row, tableFields);
            if (tableFieldKey == null) continue;

            ChangeDocField field = tableFields.get(tableFieldKey);
            Object rawValue = data.get(tableFieldKey);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> tableRows = rawValue instanceof List<?> l
                    ? (List<Map<String, Object>>) l.stream()
                        .filter(o -> o instanceof Map).collect(Collectors.toList())
                    : List.of();

            CTRow templateCtRow = row.getCtRow();

            if (tableRows.isEmpty()) {
                // §10.6 空表格：删除模板数据行，保留表头和表格本身
                table.removeRow(rowIdx);
                continue;
            }

            // 从后往前插入数据行，最终顺序与 tableRows 顺序一致
            for (int i = tableRows.size() - 1; i >= 0; i--) {
                Map<String, Object> dataRow = tableRows.get(i);
                CTRow clonedCtRow = (CTRow) templateCtRow.copy();
                XWPFTableRow insertedRow = table.insertNewTableRow(rowIdx + 1);
                insertedRow.getCtRow().set(clonedCtRow);
                // insertNewTableRow 时 XWPFTableRow 内部缓存的 cell 列表基于旧的空 ctRow 构建，
                // set() 替换底层 XML 后必须用新的 XWPFTableRow 包装同一个 ctRow 才能拿到正确的 cell/paragraph 对象
                XWPFTableRow filledRow = new XWPFTableRow(insertedRow.getCtRow(), table);
                replaceTableRowPlaceholders(filledRow, tableFieldKey, dataRow, field);
            }
            // 移除原始模板行（此时在 rowIdx 位置，因为新行都插在 rowIdx+1 之后）
            table.removeRow(rowIdx);
        }
    }

    /**
     * 若该行是某个表格字段的数据行模板（含 {{tableFieldKey.columnKey}}，且 tableFieldKey 对应
     * fieldType=table 且 tableMode=fixedDocxTable），返回其 tableFieldKey；否则返回 null。
     */
    private String detectTemplateRowFieldKey(XWPFTableRow row, Map<String, ChangeDocField> tableFields) {
        Set<String> keysInRow = new LinkedHashSet<>();
        for (XWPFTableCell cell : row.getTableCells()) {
            for (XWPFParagraph para : cell.getParagraphs()) {
                Matcher m = TABLE_PLACEHOLDER.matcher(para.getText());
                while (m.find()) keysInRow.add(m.group(1));
            }
        }
        if (keysInRow.size() != 1) return null;
        String key = keysInRow.iterator().next();
        ChangeDocField field = tableFields.get(key);
        if (field == null) return null;
        Map<String, Object> config = field.getConfig();
        Object tableMode = config != null ? config.get("tableMode") : null;
        if (!"fixedDocxTable".equals(tableMode)) return null;
        return key;
    }

    /** 只替换克隆行内 {{tableFieldKey.columnKey}} 占位符，值来自 dataRow；未配置列的占位符替换为空。 */
    private void replaceTableRowPlaceholders(XWPFTableRow row, String tableFieldKey,
                                              Map<String, Object> dataRow, ChangeDocField field) {
        Map<String, String> cellData = new LinkedHashMap<>();
        List<?> columns = field.getConfig() != null && field.getConfig().get("columns") instanceof List<?> l
                ? l : List.of();
        for (Object colObj : columns) {
            if (!(colObj instanceof Map<?, ?> col)) continue;
            Object keyObj = col.get("key");
            if (!(keyObj instanceof String colKey)) continue;
            Object v = dataRow.get(colKey);
            String s;
            if (v == null) s = "";
            else if (v instanceof Boolean b) s = b ? "是" : "否";
            else if ("select".equals(col.get("type"))) s = selectLabel(col, v);
            else s = v.toString();
            cellData.put(tableFieldKey + "." + colKey, s);
        }
        for (XWPFTableCell cell : row.getTableCells()) {
            for (XWPFParagraph para : cell.getParagraphs()) {
                replaceParagraph(para, cellData);
            }
        }
    }

    private String selectLabel(Map<?, ?> col, Object value) {
        Object optionsObj = col.get("options");
        if (optionsObj instanceof List<?> options) {
            for (Object o : options) {
                if (o instanceof Map<?, ?> opt && String.valueOf(value).equals(String.valueOf(opt.get("value")))) {
                    Object label = opt.get("label");
                    return label != null ? label.toString() : String.valueOf(value);
                }
            }
        }
        return String.valueOf(value);
    }

    private void replacePlaceholders(XWPFDocument doc, Map<String, String> data) {
        doc.getParagraphs().forEach(p -> replaceParagraph(p, data));
        doc.getTables().forEach(t -> t.getRows().forEach(r ->
                r.getTableCells().forEach(c -> c.getParagraphs().forEach(p -> replaceParagraph(p, data)))));
        doc.getHeaderList().forEach(h -> h.getParagraphs().forEach(p -> replaceParagraph(p, data)));
        doc.getFooterList().forEach(f -> f.getParagraphs().forEach(p -> replaceParagraph(p, data)));
    }

    /**
     * §10.7.4：普通替换之后仍残留 {{tableFieldKey.columnKey}} 占位符，说明模板配置与字段不一致
     * （例如占位符引用的表格字段被删除，或不是 fixedDocxTable）。此时不能静默替换为空，直接报错。
     */
    private void assertNoUnresolvedTablePlaceholders(XWPFDocument doc) {
        for (XWPFTable table : doc.getTables()) {
            for (XWPFTableRow row : table.getRows()) {
                for (XWPFTableCell cell : row.getTableCells()) {
                    for (XWPFParagraph para : cell.getParagraphs()) {
                        Matcher m = TABLE_PLACEHOLDER.matcher(para.getText());
                        if (m.find()) {
                            throw new IllegalStateException(
                                    "模板配置不一致：占位符 {{" + m.group(1) + "." + m.group(2) + "}} 未能替换");
                        }
                    }
                }
            }
        }
    }

    private void replaceParagraph(XWPFParagraph para, Map<String, String> data) {
        String full = para.getText();
        if (!full.contains("{{")) return;
        String replaced = full;
        for (Map.Entry<String, String> e : data.entrySet()) {
            replaced = replaced.replace("{{" + e.getKey() + "}}", e.getValue() != null ? e.getValue() : "");
        }
        if (replaced.equals(full)) return;
        List<XWPFRun> runs = para.getRuns();
        if (runs.isEmpty()) return;

        // 把换行符 \r\n / \r / \n 规整为 \n，再按行写入并 addBreak
        // —— Word 的 setText 不会处理换行，所以要手动 addBreak(TEXT_WRAPPING) 软换行
        String normalized = replaced.replace("\r\n", "\n").replace('\r', '\n');
        String[] lines = normalized.split("\n", -1);

        XWPFRun first = runs.get(0);
        first.setText(lines[0], 0);
        for (int i = 1; i < lines.length; i++) {
            first.addBreak(org.apache.poi.xwpf.usermodel.BreakType.TEXT_WRAPPING);
            // setText 不指定 pos 会追加到 run 末尾，但仍属于同一 run（继承样式）
            first.setText(lines[i]);
        }
        // 清空原 paragraph 里其他 run（它们的文本已经合并进 first 了）
        for (int i = 1; i < runs.size(); i++) runs.get(i).setText("", 0);
    }

    private ChangeDocTemplate getOrThrow(String tenantId, Long id) {
        ChangeDocTemplate tpl = templateMapper.selectOne(new LambdaQueryWrapper<ChangeDocTemplate>()
                .eq(ChangeDocTemplate::getTenantId, tenantId)
                .eq(ChangeDocTemplate::getId, id));
        if (tpl == null) throw new IllegalArgumentException("模板不存在: " + id);
        return tpl;
    }

    private void writeAudit(String tenantId, String action, Long targetId, Long operatorId, String remark) {
        auditLogMapper.insert(AuditLog.builder().tenantId(tenantId).module("change_doc_template")
            .action(action).targetId(targetId).targetType("change_doc_template").operatorId(operatorId)
            .remark(remark).createdAt(LocalDateTime.now()).build());
    }

    private TemplateVO toTemplateVO(ChangeDocTemplate t, List<ChangeDocField> fields) {
        TemplateVO vo = new TemplateVO();
        vo.setId(t.getId());
        vo.setName(t.getName());
        vo.setDescription(t.getDescription());
        vo.setVersion(t.getVersion());
        vo.setActive(t.getIsActive());
        vo.setHasDocx(t.getDocxKey() != null);
        vo.setDocType(t.getDocType() != null ? t.getDocType() : "general");
        vo.setCreatedAt(t.getCreatedAt() != null ? t.getCreatedAt().toString() : null);
        vo.setFields(fields.stream().map(this::toFieldVO).collect(Collectors.toList()));
        return vo;
    }

    private FieldConfigVO toFieldVO(ChangeDocField f) {
        FieldConfigVO vo = new FieldConfigVO();
        vo.setId(f.getId());
        vo.setFieldKey(f.getFieldKey());
        vo.setLabel(f.getLabel());
        vo.setFieldType(f.getFieldType());
        vo.setSortOrder(f.getSortOrder());
        vo.setRequired(f.getRequired());
        vo.setInForm(f.getInForm());
        vo.setPlaceholder(f.getPlaceholder());
        vo.setConfig(f.getConfig());
        return vo;
    }
}
