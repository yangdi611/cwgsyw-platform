package com.cwgsyw.platform.module.task.template.service;

import com.baomidou.mybatisplus.spring.service.IService;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.task.template.dto.CreateTaskTemplateRequest;
import com.cwgsyw.platform.module.task.template.dto.FieldTypeMetadata;
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

import java.util.List;

/**
 * 任务模板服务接口
 */
public interface TaskTemplateService extends IService<TaskTemplate> {

    PageResult<TaskTemplateSummaryVO> listTemplates(String tenantId, String keyword, String status,
                                                    String category, int page, int size);

    TaskTemplateDetailVO createTemplate(String tenantId, Long userId, CreateTaskTemplateRequest request);

    TaskTemplateDetailVO getTemplate(String tenantId, Long templateId);

    TaskTemplateDetailVO updateTemplate(String tenantId, Long userId, Long templateId,
                                        UpdateTaskTemplateRequest request);

    void deleteTemplate(String tenantId, Long userId, Long templateId);

    List<TaskTemplateVersionSummaryVO> listVersions(String tenantId, Long templateId);

    TaskTemplateVersionVO createDraftVersion(String tenantId, Long userId, Long templateId);

    TaskTemplateVersionVO getVersion(String tenantId, Long versionId);

    TaskTemplateVersionVO updateVersion(String tenantId, Long userId, Long versionId,
                                        UpdateTaskTemplateVersionRequest request);

    TemplateValidationResult validateVersion(String tenantId, Long versionId);

    TaskTemplateVersionVO publishVersion(String tenantId, Long userId, Long versionId);

    TaskTemplateVersionVO deprecateVersion(String tenantId, Long userId, Long versionId);

    TemplatePreviewVO previewVersion(String tenantId, Long versionId, TemplatePreviewRequest request);

    List<FieldTypeMetadata> fieldTypes();

    /**
     * 根据编码查询模板
     *
     * @param tenantId 租户ID
     * @param code 模板编码
     * @return 模板实体
     */
    TaskTemplate getByCode(String tenantId, String code);

    /**
     * 发布模板（创建新版本）
     *
     * @param templateId 模板ID
     * @param userId 发布人ID
     * @return 新版本ID
     */
    Long publishTemplate(Long templateId, Long userId);

    /**
     * 废弃模板
     *
     * @param templateId 模板ID
     * @param userId 操作人ID
     */
    void deprecateTemplate(Long templateId, Long userId);
}
