package com.cwgsyw.platform.module.task.template.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.task.template.TaskTemplateException;
import com.cwgsyw.platform.module.task.template.dto.CreateTaskTemplateRequest;
import com.cwgsyw.platform.module.task.template.dto.FieldTypeMetadata;
import com.cwgsyw.platform.module.task.template.dto.TaskFieldDefinition;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateDetailVO;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateSummaryVO;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionSummaryVO;
import com.cwgsyw.platform.module.task.template.dto.TaskTemplateVersionVO;
import com.cwgsyw.platform.module.task.template.dto.TemplatePreviewRequest;
import com.cwgsyw.platform.module.task.template.dto.TemplatePreviewVO;
import com.cwgsyw.platform.module.task.template.dto.TemplateValidationResult;
import com.cwgsyw.platform.module.task.template.dto.UpdateTaskTemplateRequest;
import com.cwgsyw.platform.module.task.template.dto.UpdateTaskTemplateVersionRequest;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplate;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateField;
import com.cwgsyw.platform.module.task.template.entity.TaskTemplateVersion;
import com.cwgsyw.platform.module.task.template.form.FieldTypeRegistry;
import com.cwgsyw.platform.module.task.template.form.TemplateFormRuntime;
import com.cwgsyw.platform.module.task.template.form.TemplateSchemaValidator;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateFieldMapper;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateMapper;
import com.cwgsyw.platform.module.task.template.mapper.TaskTemplateVersionMapper;
import com.cwgsyw.platform.module.task.template.service.TaskTemplateService;
import com.cwgsyw.platform.module.task.plan.entity.TaskPlan;
import com.cwgsyw.platform.module.task.plan.mapper.TaskPlanMapper;
import com.cwgsyw.platform.module.task.runtime.entity.TaskInstance;
import com.cwgsyw.platform.module.task.runtime.mapper.TaskInstanceMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class TaskTemplateServiceImpl extends ServiceImpl<TaskTemplateMapper, TaskTemplate>
        implements TaskTemplateService {
    private static final Set<String> TEMPLATE_STATUSES = Set.of("draft", "published", "deprecated", "archived");
    private static final Set<String> SCOPE_TYPES = Set.of("tenant", "group", "private");

    private final TaskTemplateVersionMapper versionMapper;
    private final TaskTemplateFieldMapper fieldMapper;
    private final TaskInstanceMapper taskInstanceMapper;
    private final TaskPlanMapper taskPlanMapper;
    private final TemplateSchemaValidator schemaValidator;
    private final TemplateFormRuntime formRuntime;
    private final FieldTypeRegistry fieldTypeRegistry;

    @Override
    public PageResult<TaskTemplateSummaryVO> listTemplates(String tenantId, String keyword, String status,
                                                           String category, int page, int size) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(200, Math.max(1, size));
        LambdaQueryWrapper<TaskTemplate> query = new LambdaQueryWrapper<TaskTemplate>()
            .eq(TaskTemplate::getTenantId, tenantId)
            .eq(StringUtils.hasText(status), TaskTemplate::getStatus, status)
            .eq(StringUtils.hasText(category), TaskTemplate::getCategory, category)
            .and(StringUtils.hasText(keyword), wrapper -> wrapper
                .like(TaskTemplate::getName, keyword)
                .or()
                .like(TaskTemplate::getCode, keyword))
            .orderByDesc(TaskTemplate::getUpdatedAt)
            .orderByDesc(TaskTemplate::getId);
        Page<TaskTemplate> result = page(new Page<>(safePage, safeSize), query);
        PageResult<TaskTemplateSummaryVO> response = new PageResult<>();
        response.setRecords(result.getRecords().stream().map(this::toSummary).toList());
        response.setTotal(result.getTotal());
        response.setPage(result.getCurrent());
        response.setSize(result.getSize());
        return response;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaskTemplateDetailVO createTemplate(String tenantId, Long userId, CreateTaskTemplateRequest request) {
        if (getByCode(tenantId, request.getCode()) != null) {
            throw conflict("TEMPLATE_CODE_CONFLICT", "模板编码已存在");
        }
        validateScope(request.getScopeType(), request.getOwnerGroupId());
        TaskTemplate template = new TaskTemplate();
        template.setTenantId(tenantId);
        template.setCode(request.getCode());
        template.setName(request.getName());
        template.setCategory(request.getCategory());
        template.setDescription(request.getDescription());
        template.setStatus("draft");
        template.setBuiltin(false);
        template.setScopeType(defaultScope(request.getScopeType()));
        template.setOwnerGroupId(request.getOwnerGroupId());
        template.setCreatedBy(userId);
        template.setUpdatedBy(userId);
        template.setIsDeleted(false);
        save(template);

        TaskTemplateVersion version = new TaskTemplateVersion();
        version.setTenantId(tenantId);
        version.setTemplateId(template.getId());
        version.setVersion(1);
        version.setStatus("draft");
        version.setNameSnapshot(request.getName());
        version.setDescriptionSnapshot(request.getDescription());
        version.setInstructions(request.getInstructions());
        version.setLayoutSchema(copyMap(request.getLayout()));
        version.setCompletionPolicy(copyMap(request.getCompletionPolicy()));
        version.setDefaultAssignment(copyMap(request.getDefaultAssignment()));
        version.setDefaultReminder(copyMap(request.getDefaultReminder()));
        version.setDefaultApprovalSchemeVersionId(request.getDefaultApprovalSchemeVersionId());
        version.setCreatedBy(userId);
        versionMapper.insert(version);
        replaceFields(tenantId, version.getId(), request.getFields());

        template.setLatestVersionId(version.getId());
        updateById(template);
        return getTemplate(tenantId, template.getId());
    }

    @Override
    public TaskTemplateDetailVO getTemplate(String tenantId, Long templateId) {
        TaskTemplate template = requireTemplate(tenantId, templateId);
        return toDetail(template, listVersions(tenantId, templateId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaskTemplateDetailVO updateTemplate(String tenantId, Long userId, Long templateId,
                                               UpdateTaskTemplateRequest request) {
        TaskTemplate template = requireTemplate(tenantId, templateId);
        if (Boolean.TRUE.equals(template.getBuiltin())) {
            throw conflict("BUILTIN_TEMPLATE_IMMUTABLE", "内置模板不可直接修改，请先复制");
        }
        validateScope(request.getScopeType() == null ? template.getScopeType() : request.getScopeType(),
            request.getOwnerGroupId() == null ? template.getOwnerGroupId() : request.getOwnerGroupId());
        if (request.getName() != null) template.setName(request.getName());
        if (request.getCategory() != null) template.setCategory(request.getCategory());
        if (request.getDescription() != null) template.setDescription(request.getDescription());
        if (request.getScopeType() != null) template.setScopeType(request.getScopeType());
        if (request.getOwnerGroupId() != null || "tenant".equals(request.getScopeType()) || "private".equals(request.getScopeType())) {
            template.setOwnerGroupId(request.getOwnerGroupId());
        }
        template.setUpdatedBy(userId);
        updateById(template);
        return getTemplate(tenantId, templateId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteTemplate(String tenantId, Long userId, Long templateId) {
        TaskTemplate template = requireTemplate(tenantId, templateId);
        List<TaskTemplateVersion> versions = findVersions(tenantId, templateId);
        if (isUsedByTasksOrPlans(tenantId, versions)) {
            throw conflict("TEMPLATE_IN_USE", "模板已被任务或任务计划使用，不能删除或归档");
        }
        for (TaskTemplateVersion version : versions) {
            fieldMapper.delete(new LambdaQueryWrapper<TaskTemplateField>()
                .eq(TaskTemplateField::getTenantId, tenantId)
                .eq(TaskTemplateField::getTemplateVersionId, version.getId()));
        }
        versionMapper.delete(new LambdaQueryWrapper<TaskTemplateVersion>()
            .eq(TaskTemplateVersion::getTenantId, tenantId)
            .eq(TaskTemplateVersion::getTemplateId, templateId));
        template.setDeletedAt(LocalDateTime.now());
        template.setDeletedBy(userId);
        updateById(template);
        removeById(templateId);
    }

    boolean isUsedByTasksOrPlans(String tenantId, List<TaskTemplateVersion> versions) {
        List<Long> versionIds = versions.stream().map(TaskTemplateVersion::getId).toList();
        if (versionIds.isEmpty()) return false;
        return taskInstanceMapper.selectCount(new LambdaQueryWrapper<TaskInstance>()
            .eq(TaskInstance::getTenantId, tenantId)
            .in(TaskInstance::getTemplateVersionId, versionIds)) > 0
            || taskPlanMapper.selectCount(new LambdaQueryWrapper<TaskPlan>()
                .eq(TaskPlan::getTenantId, tenantId)
                .in(TaskPlan::getTemplateVersionId, versionIds)) > 0;
    }

    @Override
    public List<TaskTemplateVersionSummaryVO> listVersions(String tenantId, Long templateId) {
        requireTemplate(tenantId, templateId);
        return findVersions(tenantId, templateId).stream().map(this::toVersionSummary).toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaskTemplateVersionVO createDraftVersion(String tenantId, Long userId, Long templateId) {
        TaskTemplate template = requireTemplate(tenantId, templateId);
        if (Boolean.TRUE.equals(template.getBuiltin())) {
            throw conflict("BUILTIN_TEMPLATE_IMMUTABLE", "内置模板不可直接新增版本，请先复制");
        }
        List<TaskTemplateVersion> versions = findVersions(tenantId, templateId);
        if (versions.stream().anyMatch(version -> "draft".equals(version.getStatus()))) {
            throw conflict("DRAFT_VERSION_EXISTS", "模板已有草稿版本");
        }
        TaskTemplateVersion source = versions.stream().findFirst()
            .orElseThrow(() -> notFound("TEMPLATE_VERSION_NOT_FOUND", "模板没有可复制版本"));
        TaskTemplateVersion draft = copyVersion(source);
        draft.setId(null);
        draft.setVersion(versions.stream().mapToInt(TaskTemplateVersion::getVersion).max().orElse(0) + 1);
        draft.setStatus("draft");
        draft.setPublishedBy(null);
        draft.setPublishedAt(null);
        draft.setCreatedBy(userId);
        versionMapper.insert(draft);
        replaceFields(tenantId, draft.getId(), toFieldDefinitions(findFields(tenantId, source.getId())));
        template.setLatestVersionId(draft.getId());
        template.setStatus("draft");
        template.setUpdatedBy(userId);
        updateById(template);
        return getVersion(tenantId, draft.getId());
    }

    @Override
    public TaskTemplateVersionVO getVersion(String tenantId, Long versionId) {
        TaskTemplateVersion version = requireVersion(tenantId, versionId);
        return toVersionVO(version, toFieldDefinitions(findFields(tenantId, versionId)));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaskTemplateVersionVO updateVersion(String tenantId, Long userId, Long versionId,
                                               UpdateTaskTemplateVersionRequest request) {
        TaskTemplateVersion version = requireDraftVersion(tenantId, versionId);
        TaskTemplate template = requireTemplate(tenantId, version.getTemplateId());
        if (Boolean.TRUE.equals(template.getBuiltin())) {
            throw conflict("BUILTIN_TEMPLATE_IMMUTABLE", "内置模板不可直接修改，请先复制");
        }
        version.setNameSnapshot(request.getName());
        version.setDescriptionSnapshot(request.getDescription());
        version.setInstructions(request.getInstructions());
        version.setLayoutSchema(copyMap(request.getLayout()));
        version.setCompletionPolicy(copyMap(request.getCompletionPolicy()));
        version.setDefaultAssignment(copyMap(request.getDefaultAssignment()));
        version.setDefaultReminder(copyMap(request.getDefaultReminder()));
        version.setDefaultApprovalSchemeVersionId(request.getDefaultApprovalSchemeVersionId());
        versionMapper.updateById(version);
        replaceFields(tenantId, versionId, request.getFields());
        template.setName(request.getName());
        template.setDescription(request.getDescription());
        template.setUpdatedBy(userId);
        updateById(template);
        return getVersion(tenantId, versionId);
    }

    @Override
    public TemplateValidationResult validateVersion(String tenantId, Long versionId) {
        requireVersion(tenantId, versionId);
        return schemaValidator.validate(toFieldDefinitions(findFields(tenantId, versionId)));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaskTemplateVersionVO publishVersion(String tenantId, Long userId, Long versionId) {
        TaskTemplateVersion version = requireDraftVersion(tenantId, versionId);
        TemplateValidationResult validation = validateVersion(tenantId, versionId);
        if (!validation.valid()) {
            throw new TaskTemplateException(HttpStatus.UNPROCESSABLE_ENTITY, "TEMPLATE_VALIDATION_FAILED",
                "模板校验失败", Map.of("issues", validation.issues()));
        }
        TaskTemplate template = requireTemplate(tenantId, version.getTemplateId());
        version.setStatus("published");
        version.setPublishedBy(userId);
        version.setPublishedAt(LocalDateTime.now());
        versionMapper.updateById(version);
        template.setLatestVersionId(versionId);
        template.setStatus("published");
        template.setName(version.getNameSnapshot());
        template.setDescription(version.getDescriptionSnapshot());
        template.setUpdatedBy(userId);
        updateById(template);
        return getVersion(tenantId, versionId);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TaskTemplateVersionVO deprecateVersion(String tenantId, Long userId, Long versionId) {
        TaskTemplateVersion version = requireVersion(tenantId, versionId);
        if (!"published".equals(version.getStatus())) {
            throw conflict("TEMPLATE_VERSION_STATE_INVALID", "只有已发布版本可以废弃");
        }
        version.setStatus("deprecated");
        versionMapper.updateById(version);
        TaskTemplate template = requireTemplate(tenantId, version.getTemplateId());
        template.setStatus("deprecated");
        template.setUpdatedBy(userId);
        updateById(template);
        return getVersion(tenantId, versionId);
    }

    @Override
    public TemplatePreviewVO previewVersion(String tenantId, Long versionId, TemplatePreviewRequest request) {
        TaskTemplateVersion version = requireVersion(tenantId, versionId);
        String role = request == null || !StringUtils.hasText(request.getRole()) ? "executor" : request.getRole();
        List<TaskFieldDefinition> allFields = toFieldDefinitions(findFields(tenantId, versionId));
        List<TaskFieldDefinition> visibleFields = allFields.stream()
            .filter(field -> formRuntime.fieldVisibleForRole(field, role))
            .toList();
        Map<String, Object> formData = request == null || request.getFormData() == null
            ? Map.of() : request.getFormData();
        TemplateFormRuntime.EvaluationResult evaluation = formRuntime.evaluate(allFields, formData);
        TaskTemplateVersionVO schema = toVersionVO(version, visibleFields);
        return TemplatePreviewVO.builder()
            .schema(schema)
            .role(role)
            .formData(filterValues(evaluation.values(), visibleFields))
            .computedValues(filterValues(evaluation.computedValues(), visibleFields))
            .visibleFields(filterBooleans(evaluation.visibleFields(), visibleFields))
            .requiredFields(filterBooleans(evaluation.requiredFields(), visibleFields))
            .valueIssues(evaluation.issues().stream()
                .filter(issue -> issue.fieldKey() == null || visibleFields.stream().anyMatch(field -> field.getKey().equals(issue.fieldKey())))
                .toList())
            .build();
    }

    @Override
    public List<FieldTypeMetadata> fieldTypes() {
        return fieldTypeRegistry.metadata();
    }

    @Override
    public TaskTemplate getByCode(String tenantId, String code) {
        return lambdaQuery()
            .eq(TaskTemplate::getTenantId, tenantId)
            .eq(TaskTemplate::getCode, code)
            .one();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long publishTemplate(Long templateId, Long userId) {
        TaskTemplate template = getById(templateId);
        if (template == null) throw notFound("TEMPLATE_NOT_FOUND", "模板不存在");
        TaskTemplateVersion draft = findVersions(template.getTenantId(), templateId).stream()
            .filter(version -> "draft".equals(version.getStatus()))
            .findFirst()
            .orElseThrow(() -> conflict("DRAFT_VERSION_NOT_FOUND", "模板没有待发布草稿"));
        return publishVersion(template.getTenantId(), userId, draft.getId()).getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deprecateTemplate(Long templateId, Long userId) {
        TaskTemplate template = getById(templateId);
        if (template == null) throw notFound("TEMPLATE_NOT_FOUND", "模板不存在");
        TaskTemplateVersion published = findVersions(template.getTenantId(), templateId).stream()
            .filter(version -> "published".equals(version.getStatus()))
            .findFirst()
            .orElseThrow(() -> conflict("PUBLISHED_VERSION_NOT_FOUND", "模板没有已发布版本"));
        deprecateVersion(template.getTenantId(), userId, published.getId());
    }

    private TaskTemplate requireTemplate(String tenantId, Long templateId) {
        TaskTemplate template = lambdaQuery()
            .eq(TaskTemplate::getTenantId, tenantId)
            .eq(TaskTemplate::getId, templateId)
            .one();
        if (template == null) throw notFound("TEMPLATE_NOT_FOUND", "模板不存在");
        return template;
    }

    private TaskTemplateVersion requireVersion(String tenantId, Long versionId) {
        TaskTemplateVersion version = versionMapper.selectOne(new LambdaQueryWrapper<TaskTemplateVersion>()
            .eq(TaskTemplateVersion::getTenantId, tenantId)
            .eq(TaskTemplateVersion::getId, versionId));
        if (version == null) throw notFound("TEMPLATE_VERSION_NOT_FOUND", "模板版本不存在");
        return version;
    }

    private TaskTemplateVersion requireDraftVersion(String tenantId, Long versionId) {
        TaskTemplateVersion version = requireVersion(tenantId, versionId);
        if (!"draft".equals(version.getStatus())) {
            throw conflict("PUBLISHED_VERSION_IMMUTABLE", "已发布或废弃的模板版本不可修改");
        }
        return version;
    }

    private List<TaskTemplateVersion> findVersions(String tenantId, Long templateId) {
        return versionMapper.selectList(new LambdaQueryWrapper<TaskTemplateVersion>()
            .eq(TaskTemplateVersion::getTenantId, tenantId)
            .eq(TaskTemplateVersion::getTemplateId, templateId)
            .orderByDesc(TaskTemplateVersion::getVersion));
    }

    private List<TaskTemplateField> findFields(String tenantId, Long versionId) {
        return fieldMapper.selectList(new LambdaQueryWrapper<TaskTemplateField>()
            .eq(TaskTemplateField::getTenantId, tenantId)
            .eq(TaskTemplateField::getTemplateVersionId, versionId)
            .orderByAsc(TaskTemplateField::getSortOrder)
            .orderByAsc(TaskTemplateField::getId));
    }

    private void replaceFields(String tenantId, Long versionId, List<TaskFieldDefinition> definitions) {
        List<TaskFieldDefinition> fields = definitions == null ? List.of() : definitions;
        fieldMapper.delete(new LambdaQueryWrapper<TaskTemplateField>()
            .eq(TaskTemplateField::getTenantId, tenantId)
            .eq(TaskTemplateField::getTemplateVersionId, versionId));
        Map<String, Long> fieldIds = new HashMap<>();
        for (int index = 0; index < fields.size(); index++) {
            TaskFieldDefinition definition = fields.get(index);
            TaskTemplateField field = toEntity(tenantId, versionId, definition, index);
            fieldMapper.insert(field);
            fieldIds.put(definition.getKey(), field.getId());
        }
        for (TaskFieldDefinition definition : fields) {
            if (!StringUtils.hasText(definition.getParentFieldKey())) continue;
            Long parentId = fieldIds.get(definition.getParentFieldKey());
            if (parentId == null) {
                throw new TaskTemplateException(HttpStatus.UNPROCESSABLE_ENTITY, "PARENT_FIELD_NOT_FOUND",
                    "父字段不存在: " + definition.getParentFieldKey());
            }
            TaskTemplateField child = fieldMapper.selectById(fieldIds.get(definition.getKey()));
            child.setParentFieldId(parentId);
            fieldMapper.updateById(child);
        }
    }

    private TaskTemplateField toEntity(String tenantId, Long versionId, TaskFieldDefinition definition, int index) {
        TaskTemplateField field = new TaskTemplateField();
        field.setTenantId(tenantId);
        field.setTemplateVersionId(versionId);
        field.setFieldKey(definition.getKey());
        field.setLabel(definition.getLabel());
        field.setFieldType(definition.getType());
        field.setSortOrder(definition.getSortOrder() == null ? index : definition.getSortOrder());
        field.setRequired(Boolean.TRUE.equals(definition.getRequired()));
        field.setDefaultValue(definition.getDefaultValue());
        field.setValidationConfig(copyMap(definition.getValidation()));
        field.setDisplayConfig(copyMap(definition.getDisplay()));
        field.setVisibilityConfig(copyMap(definition.getVisibility()));
        field.setConditionConfig(copyMap(definition.getCondition()));
        field.setFormulaConfig(copyMap(definition.getFormula()));
        field.setAnalyticsConfig(copyMap(definition.getAnalytics()));
        field.setSensitive(Boolean.TRUE.equals(definition.getSensitive()));
        return field;
    }

    private List<TaskFieldDefinition> toFieldDefinitions(List<TaskTemplateField> fields) {
        Map<Long, String> keysById = new HashMap<>();
        for (TaskTemplateField field : fields) keysById.put(field.getId(), field.getFieldKey());
        List<TaskFieldDefinition> definitions = new ArrayList<>();
        for (TaskTemplateField field : fields) {
            TaskFieldDefinition definition = new TaskFieldDefinition();
            definition.setId(field.getId());
            definition.setParentFieldKey(keysById.get(field.getParentFieldId()));
            definition.setKey(field.getFieldKey());
            definition.setLabel(field.getLabel());
            definition.setType(field.getFieldType());
            definition.setSortOrder(field.getSortOrder());
            definition.setRequired(field.getRequired());
            definition.setDefaultValue(field.getDefaultValue());
            definition.setValidation(copyMap(field.getValidationConfig()));
            definition.setDisplay(copyMap(field.getDisplayConfig()));
            definition.setVisibility(copyMap(field.getVisibilityConfig()));
            definition.setCondition(copyMap(field.getConditionConfig()));
            definition.setFormula(copyMap(field.getFormulaConfig()));
            definition.setAnalytics(copyMap(field.getAnalyticsConfig()));
            definition.setSensitive(field.getSensitive());
            definitions.add(definition);
        }
        return List.copyOf(definitions);
    }

    private TaskTemplateSummaryVO toSummary(TaskTemplate template) {
        return TaskTemplateSummaryVO.builder()
            .id(template.getId())
            .code(template.getCode())
            .name(template.getName())
            .category(template.getCategory())
            .description(template.getDescription())
            .status(template.getStatus())
            .latestVersionId(template.getLatestVersionId())
            .builtin(template.getBuiltin())
            .scopeType(template.getScopeType())
            .ownerGroupId(template.getOwnerGroupId())
            .createdAt(template.getCreatedAt())
            .updatedAt(template.getUpdatedAt())
            .build();
    }

    private TaskTemplateDetailVO toDetail(TaskTemplate template, List<TaskTemplateVersionSummaryVO> versions) {
        return TaskTemplateDetailVO.builder()
            .id(template.getId())
            .code(template.getCode())
            .name(template.getName())
            .category(template.getCategory())
            .description(template.getDescription())
            .status(template.getStatus())
            .latestVersionId(template.getLatestVersionId())
            .builtin(template.getBuiltin())
            .scopeType(template.getScopeType())
            .ownerGroupId(template.getOwnerGroupId())
            .createdAt(template.getCreatedAt())
            .updatedAt(template.getUpdatedAt())
            .versions(versions)
            .build();
    }

    private TaskTemplateVersionSummaryVO toVersionSummary(TaskTemplateVersion version) {
        return TaskTemplateVersionSummaryVO.builder()
            .id(version.getId())
            .templateId(version.getTemplateId())
            .version(version.getVersion())
            .status(version.getStatus())
            .name(version.getNameSnapshot())
            .publishedAt(version.getPublishedAt())
            .updatedAt(version.getUpdatedAt())
            .build();
    }

    private TaskTemplateVersionVO toVersionVO(TaskTemplateVersion version, List<TaskFieldDefinition> fields) {
        return TaskTemplateVersionVO.builder()
            .id(version.getId())
            .templateId(version.getTemplateId())
            .version(version.getVersion())
            .status(version.getStatus())
            .name(version.getNameSnapshot())
            .description(version.getDescriptionSnapshot())
            .instructions(version.getInstructions())
            .layout(copyMap(version.getLayoutSchema()))
            .completionPolicy(copyMap(version.getCompletionPolicy()))
            .defaultAssignment(copyMap(version.getDefaultAssignment()))
            .defaultReminder(copyMap(version.getDefaultReminder()))
            .defaultApprovalSchemeVersionId(version.getDefaultApprovalSchemeVersionId())
            .publishedBy(version.getPublishedBy())
            .publishedAt(version.getPublishedAt())
            .updatedAt(version.getUpdatedAt())
            .fields(fields)
            .build();
    }

    private static TaskTemplateVersion copyVersion(TaskTemplateVersion source) {
        TaskTemplateVersion target = new TaskTemplateVersion();
        target.setTenantId(source.getTenantId());
        target.setTemplateId(source.getTemplateId());
        target.setNameSnapshot(source.getNameSnapshot());
        target.setDescriptionSnapshot(source.getDescriptionSnapshot());
        target.setInstructions(source.getInstructions());
        target.setLayoutSchema(copyMap(source.getLayoutSchema()));
        target.setCompletionPolicy(copyMap(source.getCompletionPolicy()));
        target.setDefaultAssignment(copyMap(source.getDefaultAssignment()));
        target.setDefaultReminder(copyMap(source.getDefaultReminder()));
        target.setDefaultApprovalSchemeVersionId(source.getDefaultApprovalSchemeVersionId());
        return target;
    }

    private static Map<String, Object> filterValues(Map<String, Object> values, List<TaskFieldDefinition> fields) {
        Map<String, Object> filtered = new LinkedHashMap<>();
        for (TaskFieldDefinition field : fields) {
            if (values.containsKey(field.getKey())) filtered.put(field.getKey(), values.get(field.getKey()));
        }
        return Collections.unmodifiableMap(filtered);
    }

    private static Map<String, Boolean> filterBooleans(Map<String, Boolean> values, List<TaskFieldDefinition> fields) {
        Map<String, Boolean> filtered = new LinkedHashMap<>();
        for (TaskFieldDefinition field : fields) {
            if (values.containsKey(field.getKey())) filtered.put(field.getKey(), values.get(field.getKey()));
        }
        return Collections.unmodifiableMap(filtered);
    }

    private static Map<String, Object> copyMap(Map<String, Object> source) {
        return source == null ? null : new LinkedHashMap<>(source);
    }

    private static String defaultScope(String scopeType) {
        return StringUtils.hasText(scopeType) ? scopeType : "tenant";
    }

    private static void validateScope(String scopeType, Long ownerGroupId) {
        String safeScope = defaultScope(scopeType);
        if (!SCOPE_TYPES.contains(safeScope)) throw new IllegalArgumentException("模板范围类型无效");
        if ("group".equals(safeScope) && ownerGroupId == null) throw new IllegalArgumentException("组范围模板必须选择用户组");
    }

    private static TaskTemplateException notFound(String code, String message) {
        return new TaskTemplateException(HttpStatus.NOT_FOUND, code, message);
    }

    private static TaskTemplateException conflict(String code, String message) {
        return new TaskTemplateException(HttpStatus.CONFLICT, code, message);
    }
}
