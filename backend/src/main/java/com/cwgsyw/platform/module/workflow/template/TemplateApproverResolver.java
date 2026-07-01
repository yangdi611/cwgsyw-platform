package com.cwgsyw.platform.module.workflow.template;

import lombok.Getter;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 审批人来源（*Source）-> Flowable 候选身份 解析策略。
 *
 * <p>本类是模板机制中「approverSource 语义」的唯一权威定义，供 {@link BpmnTemplateGenerator}
 * 在生成期决定每个 userTask 的候选表达，供 {@code WorkflowRuntimeFacade} 在启动期注入运行时变量。
 *
 * <h3>解析规则（与 SPEC 决策「复用组 + 权限门控」一致）</h3>
 * <ul>
 *   <li>{@code specific_user}：创建期已知 userId -> 直接 baked 为 {@code flowable:assignee="{userId}"}；
 *       若来源选了 specific_user 但 schema 无对应 userId 字段（如两级审批一/二级），回退到提交人组。</li>
 *   <li>{@code role}：创建期已知角色 code -> baked 为候选组 {@code role_{code}}；无角色字段则回退提交人组。</li>
 *   <li>{@code submitter_group_leaders} / {@code submitter_group} / {@code specific_group}：
 *       启动期解析为提交人所在组的候选组 {@code group_{groupId}}，通过运行时变量
 *       {@link #VAR_SUBMITTER_GROUP} 注入。</li>
 * </ul>
 *
 * <p><b>越权安全性</b>：无论解析到哪个候选，任务能否 complete 仍受业务 {@code *:approve}
 * 权限门控（AND 关系，见各 {@code BusinessWorkflowAdapter#canApprove}）。因此欠定义来源回退到
 * 提交人组不会造成越权——非授权成员即便看到任务也无法通过。
 */
@Component
public class TemplateApproverResolver {

    /** 提交人组候选组 token 运行时变量名，生成期以 {@code ${submitterGroupToken}} 引用。 */
    public static final String VAR_SUBMITTER_GROUP = "submitterGroupToken";

    /** 组候选组前缀，与历史约定一致（daily-report 流程用 {@code group_{id}}）。 */
    public static final String GROUP_PREFIX = "group_";

    /** 角色候选组前缀。 */
    public static final String ROLE_PREFIX = "role_";

    /**
     * userTask 候选绑定：assignee 与 candidateGroups 至多其一非空。
     * 值可能是字面量，也可能是 {@code ${var}} 表达式（提交人组场景）。
     */
    @Getter
    public static final class ApproverBinding {
        private final String assignee;
        private final String candidateGroups;

        private ApproverBinding(String assignee, String candidateGroups) {
            this.assignee = assignee;
            this.candidateGroups = candidateGroups;
        }

        static ApproverBinding assignee(String userId) {
            return new ApproverBinding(userId, null);
        }

        static ApproverBinding candidateGroups(String groups) {
            return new ApproverBinding(null, groups);
        }
    }

    /**
     * 解析某个审批级别的候选绑定。
     *
     * @param source     该级别的 *Source 值（可空）
     * @param userId     specific_user 场景下的用户 id（该 schema 无此字段时传 null）
     * @param roleCode   role 场景下的角色 code（该 schema 无此字段时传 null）
     */
    public ApproverBinding resolve(String source, String userId, String roleCode) {
        if (source == null) {
            return submitterGroupBinding();
        }
        switch (source) {
            case "specific_user":
                if (userId != null && !userId.isBlank()) {
                    return ApproverBinding.assignee(userId.trim());
                }
                // schema 未提供 userId（两级审批一/二级）——回退提交人组，权限门控兜底
                return submitterGroupBinding();
            case "role":
                if (roleCode != null && !roleCode.isBlank()) {
                    return ApproverBinding.candidateGroups(ROLE_PREFIX + roleCode.trim());
                }
                return submitterGroupBinding();
            case "submitter_group_leaders":
            case "submitter_group":
            case "specific_group":
            default:
                // 均解析为提交人组候选组（specific_group 因 schema 无 groupId 字段同样回退）
                return submitterGroupBinding();
        }
    }

    /** 提交人组候选绑定——引用启动期注入的运行时变量。 */
    private ApproverBinding submitterGroupBinding() {
        return ApproverBinding.candidateGroups("${" + VAR_SUBMITTER_GROUP + "}");
    }

    /** 组 token。 */
    public String groupToken(Long groupId) {
        return GROUP_PREFIX + groupId;
    }

    /**
     * 启动期运行时变量：注入提交人组 token，供生成期以 {@code ${submitterGroupToken}} 的
     * userTask candidateGroups 消费。提交人无组时不注入（任务将无候选组，仅靠权限门控 + 认领）。
     */
    public Map<String, Object> startVariables(Long submitterGroupId) {
        Map<String, Object> vars = new HashMap<>();
        if (submitterGroupId != null) {
            vars.put(VAR_SUBMITTER_GROUP, groupToken(submitterGroupId));
        }
        return vars;
    }
}
