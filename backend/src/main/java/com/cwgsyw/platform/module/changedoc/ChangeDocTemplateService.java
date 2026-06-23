package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.module.changedoc.dto.*;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocField;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocTemplate;
import lombok.RequiredArgsConstructor;
import org.apache.poi.xwpf.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

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
    private final MinioStorageService storage;

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
        return toTemplateVO(tpl, List.of());
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

    public List<String> parseBookmarks(String tenantId, Long templateId) {
        ChangeDocTemplate tpl = getOrThrow(tenantId, templateId);
        if (tpl.getDocxKey() == null) throw new IllegalStateException("请先上传模板文件");

        List<String> bookmarks = new ArrayList<>();
        Pattern pattern = Pattern.compile("\\{\\{([^}]+)}}");
        try (InputStream in = storage.download(tpl.getDocxKey());
             XWPFDocument doc = new XWPFDocument(in)) {
            for (XWPFParagraph para : doc.getParagraphs()) {
                Matcher m = pattern.matcher(para.getText());
                while (m.find()) bookmarks.add(m.group(1).trim());
            }
            for (XWPFTable table : doc.getTables()) {
                for (XWPFTableRow row : table.getRows()) {
                    for (XWPFTableCell cell : row.getTableCells()) {
                        for (XWPFParagraph para : cell.getParagraphs()) {
                            Matcher m = pattern.matcher(para.getText());
                            while (m.find()) bookmarks.add(m.group(1).trim());
                        }
                    }
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("解析模板书签失败: " + e.getMessage(), e);
        }

        List<ChangeDocField> existing = fieldMapper.findByTemplate(templateId);
        Set<String> existingKeys = existing.stream().map(ChangeDocField::getFieldKey).collect(Collectors.toSet());
        int maxOrder = existing.stream().mapToInt(ChangeDocField::getSortOrder).max().orElse(0);

        for (String key : new LinkedHashSet<>(bookmarks)) {
            if (!existingKeys.contains(key)) {
                ChangeDocField f = new ChangeDocField();
                f.setTenantId(tenantId);
                f.setTemplateId(templateId);
                f.setFieldKey(key);
                f.setLabel(key);
                f.setFieldType("textarea");
                f.setSortOrder(++maxOrder);
                f.setRequired(false);
                f.setInForm(true);
                fieldMapper.insert(f);
            }
        }
        return new ArrayList<>(new LinkedHashSet<>(bookmarks));
    }

    @Transactional
    public void saveFields(String tenantId, Long templateId, SaveFieldRequest req) {
        getOrThrow(tenantId, templateId);
        for (SaveFieldRequest.FieldItem item : req.getFields()) {
            if (item.getId() != null && item.getId() > 0) {
                fieldMapper.update(null, new LambdaUpdateWrapper<ChangeDocField>()
                        .eq(ChangeDocField::getId, item.getId())
                        .eq(ChangeDocField::getTemplateId, templateId)
                        .set(ChangeDocField::getLabel, item.getLabel())
                        .set(ChangeDocField::getFieldType, item.getFieldType())
                        .set(ChangeDocField::getSortOrder, item.getSortOrder())
                        .set(ChangeDocField::getRequired, item.getRequired())
                        .set(ChangeDocField::getInForm, item.getInForm())
                        .set(ChangeDocField::getPlaceholder, item.getPlaceholder()));
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

    public byte[] fillDocx(String tenantId, Long templateId, Map<String, String> fieldsData) {
        ChangeDocTemplate tpl = getOrThrow(tenantId, templateId);
        if (tpl.getDocxKey() == null) throw new IllegalStateException("该模板尚未上传 Word 文件");
        try (InputStream in = storage.download(tpl.getDocxKey());
             XWPFDocument doc = new XWPFDocument(in);
             java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            replacePlaceholders(doc, fieldsData != null ? fieldsData : Map.of());
            doc.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("填充模板失败: " + e.getMessage(), e);
        }
    }

    private void replacePlaceholders(XWPFDocument doc, Map<String, String> data) {
        doc.getParagraphs().forEach(p -> replaceParagraph(p, data));
        doc.getTables().forEach(t -> t.getRows().forEach(r ->
                r.getTableCells().forEach(c -> c.getParagraphs().forEach(p -> replaceParagraph(p, data)))));
        doc.getHeaderList().forEach(h -> h.getParagraphs().forEach(p -> replaceParagraph(p, data)));
        doc.getFooterList().forEach(f -> f.getParagraphs().forEach(p -> replaceParagraph(p, data)));
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
        return vo;
    }
}
