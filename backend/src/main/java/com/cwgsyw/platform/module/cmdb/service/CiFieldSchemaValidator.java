package com.cwgsyw.platform.module.cmdb.service;

import com.cwgsyw.platform.module.cmdb.entity.CiAssociationAttrDef;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Schema validation for CI instance attributes and association metadata.
 *
 * <p>Extracted from the former {@code CiInstanceService.SchemaValidator} inner
 * class (Issue #64 AC9) so the same type-checking rules are reusable across
 * instance creation, relation metadata, and import flows (AD-5 shared validator).
 * Behaviour is unchanged from the original static implementation.
 */
@Component
@RequiredArgsConstructor
public class CiFieldSchemaValidator {

    private final ObjectMapper objectMapper;

    public void validate(Map<String, Object> fieldsData, List<CiAttribute> attributes) {
        if (fieldsData == null) fieldsData = Map.of();
        for (CiAttribute attr : attributes) {
            Object value = fieldsData.get(attr.getFieldKey());
            if (Boolean.TRUE.equals(attr.getIsRequired()) && value == null) {
                throw new IllegalArgumentException("必填字段缺失: " + attr.getName());
            }
            if (value == null) continue;
            validateFieldType(attr.getName(), attr.getFieldType(), attr.getOption(), value);
        }
    }

    /**
     * Validate metadata fields against association attribute definitions.
     * Reuses the same type-checking logic as instance attribute validation.
     */
    public void validateAssociationAttrs(Map<String, Object> metadata, List<CiAssociationAttrDef> attrDefs) {
        if (metadata == null) metadata = Map.of();
        for (CiAssociationAttrDef attr : attrDefs) {
            Object value = metadata.get(attr.getFieldKey());
            if (Boolean.TRUE.equals(attr.getIsRequired()) && value == null) {
                throw new IllegalArgumentException("必填字段缺失: " + attr.getName());
            }
            if (value == null) continue;
            validateFieldType(attr.getName(), attr.getFieldType(), attr.getEnumOptions(), value);
        }
    }

    private void validateFieldType(String name, String fieldType, Object optionOrEnumOptions, Object value) {
        // Resolve valid option IDs for enum/enummulti validation — supports both
        // List<Map> (new CiAttribute.option) and String (legacy enumOptions)
        Set<String> validIds = null;
        if (optionOrEnumOptions instanceof List<?> list && !list.isEmpty()) {
            validIds = list.stream()
                    .filter(Map.class::isInstance)
                    .map(opt -> (String) ((Map<?, ?>) opt).get("id"))
                    .collect(Collectors.toSet());
        } else if (optionOrEnumOptions instanceof String s && !s.isBlank()) {
            try {
                List<Map<String, Object>> opts =
                        objectMapper.readValue(s, new TypeReference<>() {});
                validIds = opts.stream().map(opt -> (String) opt.get("id"))
                        .collect(Collectors.toSet());
            } catch (Exception ignored) {}
        }
        switch (fieldType) {
            case "singlechar", "longchar", "objuser", "date" -> {
                if (!(value instanceof String))
                    throw new IllegalArgumentException("字段 " + name + " 应为字符串类型");
            }
            case "int" -> {
                if (!(value instanceof Number))
                    throw new IllegalArgumentException("字段 " + name + " 应为整数类型");
            }
            case "float" -> {
                if (!(value instanceof Number))
                    throw new IllegalArgumentException("字段 " + name + " 应为浮点类型");
            }
            case "bool" -> {
                if (!(value instanceof Boolean))
                    throw new IllegalArgumentException("字段 " + name + " 应为布尔类型");
            }
            case "enum" -> {
                if (!(value instanceof String enumVal))
                    throw new IllegalArgumentException("字段 " + name + " 应为字符串类型");
                if (validIds != null && !validIds.isEmpty()) {
                    if (!validIds.contains(enumVal))
                        throw new IllegalArgumentException("字段 " + name + " 的值不在可选范围内: " + enumVal);
                }
            }
            case "enummulti" -> {
                if (!(value instanceof String))
                    throw new IllegalArgumentException("字段 " + name + " 应为字符串类型(JSON数组)");
                try {
                    List<String> selected = objectMapper.readValue((String) value, new TypeReference<>() {});
                    if (validIds != null && !validIds.isEmpty()) {
                        for (String sel : selected) {
                            if (!validIds.contains(sel))
                                throw new IllegalArgumentException("字段 " + name + " 的值不在可选范围内: " + sel);
                        }
                    }
                } catch (IllegalArgumentException e) { throw e; } catch (Exception e) {
                    throw new IllegalArgumentException("字段 " + name + " 应为JSON数组格式: " + value);
                }
            }
            default -> {}
        }
    }
}
