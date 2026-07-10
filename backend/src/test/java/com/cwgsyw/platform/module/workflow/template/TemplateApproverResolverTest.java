package com.cwgsyw.platform.module.workflow.template;

import com.cwgsyw.platform.module.workflow.template.TemplateApproverResolver.ApproverBinding;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class TemplateApproverResolverTest {

    private final TemplateApproverResolver resolver = new TemplateApproverResolver();

    @Test
    void specificUserWithIdBakesAssignee() {
        ApproverBinding b = resolver.resolve("specific_user", "42", null);
        assertThat(b.getAssignee()).isEqualTo("42");
        assertThat(b.getCandidateGroups()).isNull();
    }

    @Test
    void specificUserTrimsWhitespace() {
        ApproverBinding b = resolver.resolve("specific_user", "  42 ", null);
        assertThat(b.getAssignee()).isEqualTo("42");
    }

    @Test
    void specificUserWithoutIdFallsBackToSubmitterGroup() {
        ApproverBinding b = resolver.resolve("specific_user", null, null);
        assertThat(b.getAssignee()).isNull();
        assertThat(b.getCandidateGroups()).isEqualTo("${" + TemplateApproverResolver.VAR_SUBMITTER_GROUP + "}");
    }

    @Test
    void specificUserWithBlankIdFallsBackToSubmitterGroup() {
        ApproverBinding b = resolver.resolve("specific_user", "   ", null);
        assertThat(b.getCandidateGroups()).isEqualTo("${" + TemplateApproverResolver.VAR_SUBMITTER_GROUP + "}");
    }

    @Test
    void roleWithCodeBakesRoleCandidateGroup() {
        ApproverBinding b = resolver.resolve("role", null, "admin");
        assertThat(b.getAssignee()).isNull();
        assertThat(b.getCandidateGroups()).isEqualTo("role_admin");
    }

    @Test
    void roleWithoutCodeFallsBackToSubmitterGroup() {
        ApproverBinding b = resolver.resolve("role", null, null);
        assertThat(b.getCandidateGroups()).isEqualTo("${" + TemplateApproverResolver.VAR_SUBMITTER_GROUP + "}");
    }

    @Test
    void submitterGroupSourcesResolveToSubmitterGroupToken() {
        String expected = "${" + TemplateApproverResolver.VAR_SUBMITTER_GROUP + "}";
        assertThat(resolver.resolve("submitter_group_leaders", null, null).getCandidateGroups()).isEqualTo(expected);
        assertThat(resolver.resolve("submitter_group", null, null).getCandidateGroups()).isEqualTo(expected);
        assertThat(resolver.resolve("specific_group", null, null).getCandidateGroups()).isEqualTo(expected);
    }

    @Test
    void nullSourceFallsBackToSubmitterGroup() {
        ApproverBinding b = resolver.resolve(null, null, null);
        assertThat(b.getCandidateGroups()).isEqualTo("${" + TemplateApproverResolver.VAR_SUBMITTER_GROUP + "}");
    }

    @Test
    void unknownSourceFallsBackToSubmitterGroup() {
        ApproverBinding b = resolver.resolve("something_new", null, null);
        assertThat(b.getCandidateGroups()).isEqualTo("${" + TemplateApproverResolver.VAR_SUBMITTER_GROUP + "}");
    }

    @Test
    void groupTokenUsesPrefix() {
        assertThat(resolver.groupToken(7L)).isEqualTo("group_7");
    }

    @Test
    void startVariablesInjectsTokenWhenGroupPresent() {
        Map<String, Object> vars = resolver.startVariables(7L);
        assertThat(vars).containsEntry(TemplateApproverResolver.VAR_SUBMITTER_GROUP, "group_7");
    }

    @Test
    void startVariablesEmptyWhenNoGroup() {
        assertThat(resolver.startVariables(null)).isEmpty();
    }
}
