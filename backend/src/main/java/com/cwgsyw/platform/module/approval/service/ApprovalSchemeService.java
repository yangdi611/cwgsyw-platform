package com.cwgsyw.platform.module.approval.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.approval.dto.ApprovalDefinitionRequest;
import com.cwgsyw.platform.module.approval.dto.ApprovalNodeRequest;
import com.cwgsyw.platform.module.approval.dto.ApprovalSchemeVO;
import com.cwgsyw.platform.module.approval.dto.ApprovalSchemeVersionVO;
import com.cwgsyw.platform.module.approval.dto.CreateApprovalSchemeRequest;
import com.cwgsyw.platform.module.approval.dto.UpdateApprovalSchemeRequest;
import com.cwgsyw.platform.module.approval.dto.UpdateApprovalSchemeVersionRequest;
import com.cwgsyw.platform.module.approval.entity.ApprovalScheme;
import com.cwgsyw.platform.module.approval.entity.ApprovalSchemeVersion;
import com.cwgsyw.platform.module.approval.mapper.ApprovalSchemeMapper;
import com.cwgsyw.platform.module.approval.mapper.ApprovalSchemeVersionMapper;
import com.cwgsyw.platform.module.approval.workflow.ApprovalProcessNode;
import com.cwgsyw.platform.module.approval.workflow.TaskApprovalWorkflowPort;
import com.cwgsyw.platform.module.org.GroupMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.module.rbac.SysRoleMapper;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ApprovalSchemeService {
    private static final Pattern NODE_KEY = Pattern.compile("[a-z][a-z0-9_]{1,99}");
    private static final Set<String> SCOPES = Set.of("tenant", "group", "private");
    private static final Set<String> ACTIONS = Set.of(
        "approve", "return_for_changes", "return_previous_node", "terminate");
    private static final Set<String> APPROVER_TYPES = Set.of("user", "group", "role");

    private final ApprovalSchemeMapper schemeMapper;
    private final ApprovalSchemeVersionMapper versionMapper;
    private final UserMapper userMapper;
    private final GroupMapper groupMapper;
    private final SysRoleMapper roleMapper;
    private final TaskApprovalWorkflowPort workflowPort;
    private final ObjectMapper objectMapper;

    public PageResult<ApprovalSchemeVO> list(String tenantId, String keyword, String status, int page, int size) {
        Page<ApprovalScheme> result = schemeMapper.selectPage(new Page<>(Math.max(1, page), Math.min(200, Math.max(1, size))),
            new LambdaQueryWrapper<ApprovalScheme>()
                .eq(ApprovalScheme::getTenantId, tenantId)
                .eq(StringUtils.hasText(status), ApprovalScheme::getStatus, status)
                .and(StringUtils.hasText(keyword), query -> query.like(ApprovalScheme::getName, keyword)
                    .or().like(ApprovalScheme::getCode, keyword))
                .orderByDesc(ApprovalScheme::getUpdatedAt));
        PageResult<ApprovalSchemeVO> response = new PageResult<>();
        response.setRecords(result.getRecords().stream().map(this::toVO).toList());
        response.setTotal(result.getTotal());
        response.setPage(result.getCurrent());
        response.setSize(result.getSize());
        return response;
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalSchemeVO create(String tenantId, Long operatorId, CreateApprovalSchemeRequest request) {
        validateScope(tenantId, request.scopeType(), request.ownerGroupId());
        validateDefinition(tenantId, request.definition());
        if (schemeMapper.selectCount(new LambdaQueryWrapper<ApprovalScheme>()
                .eq(ApprovalScheme::getTenantId, tenantId).eq(ApprovalScheme::getCode, request.code())) > 0) {
            throw conflict("APPROVAL_SCHEME_CODE_EXISTS", "审批方案编码已存在");
        }
        ApprovalScheme scheme = new ApprovalScheme();
        scheme.setTenantId(tenantId);
        scheme.setCode(request.code());
        scheme.setName(request.name().trim());
        scheme.setDescription(request.description());
        scheme.setStatus("draft");
        scheme.setScopeType(request.scopeType());
        scheme.setOwnerGroupId(request.ownerGroupId());
        scheme.setCreatedBy(operatorId);
        scheme.setUpdatedBy(operatorId);
        scheme.setCreatedAt(LocalDateTime.now());
        scheme.setUpdatedAt(LocalDateTime.now());
        scheme.setIsDeleted(false);
        schemeMapper.insert(scheme);

        ApprovalSchemeVersion version = newVersion(scheme, 1, request.definition(), operatorId);
        versionMapper.insert(version);
        scheme.setLatestVersionId(version.getId());
        schemeMapper.updateById(scheme);
        return toVO(scheme, version);
    }

    public ApprovalSchemeVO get(String tenantId, Long schemeId) {
        ApprovalScheme scheme = requireScheme(tenantId, schemeId);
        return toVO(scheme);
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalSchemeVO update(String tenantId, Long operatorId, Long schemeId,
                                   UpdateApprovalSchemeRequest request) {
        ApprovalScheme scheme = requireScheme(tenantId, schemeId);
        if ("archived".equals(scheme.getStatus())) throw conflict("APPROVAL_SCHEME_ARCHIVED", "已归档方案不可修改");
        validateScope(tenantId, request.scopeType(), request.ownerGroupId());
        scheme.setName(request.name().trim());
        scheme.setDescription(request.description());
        scheme.setScopeType(request.scopeType());
        scheme.setOwnerGroupId(request.ownerGroupId());
        scheme.setUpdatedBy(operatorId);
        scheme.setUpdatedAt(LocalDateTime.now());
        schemeMapper.updateById(scheme);
        return toVO(scheme);
    }

    public List<ApprovalSchemeVersionVO> versions(String tenantId, Long schemeId) {
        requireScheme(tenantId, schemeId);
        return versionMapper.selectList(new LambdaQueryWrapper<ApprovalSchemeVersion>()
            .eq(ApprovalSchemeVersion::getTenantId, tenantId)
            .eq(ApprovalSchemeVersion::getSchemeId, schemeId)
            .orderByDesc(ApprovalSchemeVersion::getVersion)).stream().map(this::toVersionVO).toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalSchemeVersionVO createVersion(String tenantId, Long operatorId, Long schemeId) {
        ApprovalScheme scheme = requireScheme(tenantId, schemeId);
        if ("archived".equals(scheme.getStatus())) throw conflict("APPROVAL_SCHEME_ARCHIVED", "已归档方案不可创建版本");
        ApprovalSchemeVersion latest = latestVersion(tenantId, schemeId);
        if (latest != null && "draft".equals(latest.getStatus())) {
            throw conflict("APPROVAL_SCHEME_DRAFT_EXISTS", "请先完成现有草稿版本");
        }
        ApprovalDefinitionRequest definition = latest == null
            ? new ApprovalDefinitionRequest(List.of(), ACTIONS)
            : definition(latest);
        ApprovalSchemeVersion created = newVersion(scheme, latest == null ? 1 : latest.getVersion() + 1,
            definition, operatorId);
        versionMapper.insert(created);
        scheme.setLatestVersionId(created.getId());
        scheme.setUpdatedBy(operatorId);
        scheme.setUpdatedAt(LocalDateTime.now());
        schemeMapper.updateById(scheme);
        return toVersionVO(created);
    }

    public ApprovalSchemeVersionVO version(String tenantId, Long versionId) {
        return toVersionVO(requireVersion(tenantId, versionId));
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalSchemeVersionVO updateVersion(String tenantId, Long operatorId, Long versionId,
                                                  UpdateApprovalSchemeVersionRequest request) {
        ApprovalSchemeVersion version = requireVersion(tenantId, versionId);
        if (!"draft".equals(version.getStatus())) throw conflict("APPROVAL_VERSION_IMMUTABLE", "已发布版本不可修改");
        validateDefinition(tenantId, request.definition());
        version.setDefinitionConfig(toMap(request.definition()));
        version.setUpdatedAt(LocalDateTime.now());
        versionMapper.updateById(version);
        ApprovalScheme scheme = requireScheme(tenantId, version.getSchemeId());
        scheme.setUpdatedBy(operatorId);
        scheme.setUpdatedAt(LocalDateTime.now());
        schemeMapper.updateById(scheme);
        return toVersionVO(version);
    }

    @Transactional(rollbackFor = Exception.class)
    public ApprovalSchemeVersionVO publish(String tenantId, Long operatorId, Long versionId) {
        ApprovalSchemeVersion version = requireVersion(tenantId, versionId);
        if (!"draft".equals(version.getStatus())) throw conflict("APPROVAL_VERSION_IMMUTABLE", "审批方案版本已发布");
        ApprovalScheme scheme = requireScheme(tenantId, version.getSchemeId());
        ApprovalDefinitionRequest definition = definition(version);
        List<ApprovalProcessNode> nodes = validateDefinition(tenantId, definition);
        String processKey = "task_approval_" + scheme.getId() + "_v" + version.getVersion();
        var deployment = workflowPort.publish(tenantId, processKey, scheme.getName(), nodes);
        version.setStatus("published");
        version.setProcessDefinitionId(deployment.processDefinitionId());
        version.setProcessDefinitionKey(deployment.processDefinitionKey());
        version.setProcessDefinitionVersion(deployment.processDefinitionVersion());
        version.setPublishedBy(operatorId);
        version.setPublishedAt(LocalDateTime.now());
        version.setUpdatedAt(LocalDateTime.now());
        versionMapper.updateById(version);
        scheme.setStatus("published");
        scheme.setLatestVersionId(version.getId());
        scheme.setUpdatedBy(operatorId);
        scheme.setUpdatedAt(LocalDateTime.now());
        schemeMapper.updateById(scheme);
        return toVersionVO(version);
    }

    public ApprovalSchemeVersion requirePublishedVersion(String tenantId, Long versionId) {
        ApprovalSchemeVersion version = requireVersion(tenantId, versionId);
        if (!"published".equals(version.getStatus()) || !StringUtils.hasText(version.getProcessDefinitionId())) {
            throw conflict("APPROVAL_VERSION_NOT_PUBLISHED", "审批方案版本尚未发布");
        }
        return version;
    }

    private List<ApprovalProcessNode> validateDefinition(String tenantId, ApprovalDefinitionRequest definition) {
        if (definition == null || definition.nodes() == null || definition.nodes().isEmpty()) {
            throw BusinessException.badRequest("APPROVAL_NODES_REQUIRED", "审批方案至少需要一个审批节点");
        }
        if (definition.nodes().size() > 10) throw BusinessException.badRequest("APPROVAL_NODES_TOO_MANY", "审批节点不能超过 10 个");
        Set<String> actions = definition.allowedActions() == null || definition.allowedActions().isEmpty()
            ? ACTIONS : definition.allowedActions();
        if (!ACTIONS.containsAll(actions) || !actions.contains("approve")) {
            throw BusinessException.badRequest("APPROVAL_ACTIONS_INVALID", "审批动作配置无效");
        }
        Set<String> keys = new LinkedHashSet<>();
        List<ApprovalProcessNode> processNodes = new ArrayList<>();
        for (ApprovalNodeRequest node : definition.nodes()) {
            if (node == null || !StringUtils.hasText(node.key()) || !NODE_KEY.matcher(node.key()).matches()
                    || !keys.add(node.key())) {
                throw BusinessException.badRequest("APPROVAL_NODE_KEY_INVALID", "审批节点编码无效或重复");
            }
            if (!StringUtils.hasText(node.name()) || node.name().length() > 255) {
                throw BusinessException.badRequest("APPROVAL_NODE_NAME_INVALID", "审批节点名称不能为空且不能超过 255 字");
            }
            if (!APPROVER_TYPES.contains(node.approverType())) {
                throw BusinessException.badRequest("APPROVAL_APPROVER_TYPE_INVALID", "审批人类型无效");
            }
            processNodes.add(resolveApprover(tenantId, node));
        }
        return processNodes;
    }

    private ApprovalProcessNode resolveApprover(String tenantId, ApprovalNodeRequest node) {
        if ("user".equals(node.approverType())) {
            User user = node.userId() == null ? null : userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getTenantId, tenantId).eq(User::getId, node.userId())
                .eq(User::getIsDeleted, false).eq(User::getStatus, 1));
            if (user == null) throw BusinessException.badRequest("APPROVAL_USER_INVALID", "指定审批人不存在或已停用");
            return new ApprovalProcessNode(node.key(), node.name().trim(), String.valueOf(user.getId()), null);
        }
        if ("group".equals(node.approverType())) {
            Group group = node.groupId() == null ? null : groupMapper.selectOne(new LambdaQueryWrapper<Group>()
                .eq(Group::getTenantId, tenantId).eq(Group::getId, node.groupId()).eq(Group::getIsDeleted, false));
            if (group == null) throw BusinessException.badRequest("APPROVAL_GROUP_INVALID", "指定审批组不存在或已停用");
            return new ApprovalProcessNode(node.key(), node.name().trim(), null, "group_" + group.getId());
        }
        SysRole role = !StringUtils.hasText(node.roleCode()) ? null : roleMapper.selectOne(new LambdaQueryWrapper<SysRole>()
            .eq(SysRole::getTenantId, tenantId).eq(SysRole::getCode, node.roleCode().trim()).eq(SysRole::getIsDeleted, false));
        if (role == null) throw BusinessException.badRequest("APPROVAL_ROLE_INVALID", "指定审批角色不存在或已停用");
        return new ApprovalProcessNode(node.key(), node.name().trim(), null, "role_" + role.getCode());
    }

    private void validateScope(String tenantId, String scopeType, Long ownerGroupId) {
        if (!SCOPES.contains(scopeType)) throw BusinessException.badRequest("APPROVAL_SCOPE_INVALID", "审批方案范围无效");
        if ("group".equals(scopeType)) {
            Group group = ownerGroupId == null ? null : groupMapper.selectOne(new LambdaQueryWrapper<Group>()
                .eq(Group::getTenantId, tenantId).eq(Group::getId, ownerGroupId).eq(Group::getIsDeleted, false));
            if (group == null) throw BusinessException.badRequest("APPROVAL_SCOPE_GROUP_INVALID", "审批方案所属组不存在");
        } else if (ownerGroupId != null) {
            throw BusinessException.badRequest("APPROVAL_SCOPE_GROUP_UNEXPECTED", "非组范围方案不能设置所属组");
        }
    }

    private ApprovalScheme requireScheme(String tenantId, Long schemeId) {
        ApprovalScheme scheme = schemeMapper.selectOne(new LambdaQueryWrapper<ApprovalScheme>()
            .eq(ApprovalScheme::getTenantId, tenantId).eq(ApprovalScheme::getId, schemeId));
        if (scheme == null) throw notFound("APPROVAL_SCHEME_NOT_FOUND", "审批方案不存在");
        return scheme;
    }

    private ApprovalSchemeVersion requireVersion(String tenantId, Long versionId) {
        ApprovalSchemeVersion version = versionMapper.selectOne(new LambdaQueryWrapper<ApprovalSchemeVersion>()
            .eq(ApprovalSchemeVersion::getTenantId, tenantId).eq(ApprovalSchemeVersion::getId, versionId));
        if (version == null) throw notFound("APPROVAL_VERSION_NOT_FOUND", "审批方案版本不存在");
        return version;
    }

    private ApprovalSchemeVersion latestVersion(String tenantId, Long schemeId) {
        return versionMapper.selectOne(new LambdaQueryWrapper<ApprovalSchemeVersion>()
            .eq(ApprovalSchemeVersion::getTenantId, tenantId).eq(ApprovalSchemeVersion::getSchemeId, schemeId)
            .orderByDesc(ApprovalSchemeVersion::getVersion).last("LIMIT 1"));
    }

    private ApprovalSchemeVersion newVersion(ApprovalScheme scheme, int number,
                                              ApprovalDefinitionRequest definition, Long operatorId) {
        ApprovalSchemeVersion version = new ApprovalSchemeVersion();
        version.setTenantId(scheme.getTenantId());
        version.setSchemeId(scheme.getId());
        version.setVersion(number);
        version.setStatus("draft");
        version.setDefinitionConfig(toMap(definition));
        version.setCreatedBy(operatorId);
        version.setCreatedAt(LocalDateTime.now());
        version.setUpdatedAt(LocalDateTime.now());
        return version;
    }

    private Map<String, Object> toMap(ApprovalDefinitionRequest definition) {
        return objectMapper.convertValue(definition, new TypeReference<>() { });
    }

    private ApprovalDefinitionRequest definition(ApprovalSchemeVersion version) {
        return objectMapper.convertValue(version.getDefinitionConfig(), ApprovalDefinitionRequest.class);
    }

    private ApprovalSchemeVO toVO(ApprovalScheme scheme) {
        ApprovalSchemeVersion latest = scheme.getLatestVersionId() == null ? null
            : versionMapper.selectById(scheme.getLatestVersionId());
        return toVO(scheme, latest);
    }

    private ApprovalSchemeVO toVO(ApprovalScheme scheme, ApprovalSchemeVersion latest) {
        return new ApprovalSchemeVO(scheme.getId(), scheme.getCode(), scheme.getName(), scheme.getDescription(),
            scheme.getStatus(), scheme.getLatestVersionId(), scheme.getScopeType(), scheme.getOwnerGroupId(),
            scheme.getCreatedAt(), scheme.getUpdatedAt(), latest == null ? null : toVersionVO(latest));
    }

    private ApprovalSchemeVersionVO toVersionVO(ApprovalSchemeVersion version) {
        return new ApprovalSchemeVersionVO(version.getId(), version.getSchemeId(), version.getVersion(),
            version.getStatus(), definition(version), version.getProcessDefinitionId(), version.getProcessDefinitionKey(),
            version.getProcessDefinitionVersion(), version.getPublishedBy(), version.getPublishedAt(),
            version.getCreatedAt(), version.getUpdatedAt());
    }

    private BusinessException notFound(String code, String message) {
        return new BusinessException(HttpStatus.NOT_FOUND, code, message);
    }

    private BusinessException conflict(String code, String message) {
        return new BusinessException(HttpStatus.CONFLICT, code, message);
    }
}
