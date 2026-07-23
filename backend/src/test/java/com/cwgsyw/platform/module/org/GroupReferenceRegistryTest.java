package com.cwgsyw.platform.module.org;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GroupReferenceRegistryTest {

    @Test
    void registryIsUniqueCompleteAndVersioned() {
        assertEquals("group-reference-registry/v2", GroupReferenceRegistry.VERSION);
        assertTrue(GroupReferenceRegistry.validationErrors().isEmpty(),
            GroupReferenceRegistry.validationErrors().toString());
        assertEquals(19, GroupReferenceRegistry.requiredTriggers().size());
        assertEquals(5, GroupReferenceRegistry.requiredFunctions().size());
        assertEquals(9, GroupReferenceRegistry.requiredForeignKeys().size());

        Set<String> referenceTypes = new HashSet<>();
        GroupReferenceRegistry.descriptors().forEach(descriptor -> {
            assertTrue(referenceTypes.add(descriptor.referenceType()), descriptor.referenceType());
            assertTrue(descriptor.purgeDisposition() == GroupReferenceRegistry.Disposition.BLOCKER);
            assertTrue(descriptor.purgeReasonCode().startsWith("GROUP_PURGE_REFERENCE_"));
        });
    }

    @Test
    void registryCoversSpecReferenceDenominator() {
        Set<String> referenceTypes = new HashSet<>();
        GroupReferenceRegistry.descriptors().forEach(
            descriptor -> referenceTypes.add(descriptor.referenceType()));

        assertTrue(referenceTypes.containsAll(Set.of(
            "leaders", "primaryUsers", "memberships", "roleAssignments", "devices",
            "deviceCredentials", "currentFutureRosters", "activeTaskTemplates", "activeApprovalSchemes",
            "activeTaskInstances", "activeAnalyticsDashboards", "runningWorkflowLinks", "flowableIdentityMemberships",
            "flowablePrivilegeMappings", "wikiSpaceOwners", "wikiPageOwners",
            "sharedFolderOwners", "sharedFileOwners", "resourceAcls", "sharedFileVisibleGroups",
            "workflowHistoryLinks"
        )));
        assertTrue(referenceTypes.containsAll(Set.of(
            "wikiSpaceAcls", "wikiPageAcls", "sharedFolderAcls"
        )));
        assertTrue(referenceTypes.containsAll(Set.of(
            "runningWorkflowVariables", "workflowHistoryVariables", "workflowHistoryDetails"
        )));
    }

    @Test
    void everyRegisteredApplicationWriterSymbolExistsInSource() throws Exception {
        Path sourceRoot = Path.of("src/main/java/com/cwgsyw/platform/module");
        Map<String, String> sourcesByClass;
        try (var paths = Files.walk(sourceRoot)) {
            sourcesByClass = paths.filter(path -> path.toString().endsWith(".java"))
                .collect(Collectors.toMap(
                    path -> path.getFileName().toString().replaceFirst("\\.java$", ""),
                    path -> {
                    try {
                        return Files.readString(path);
                    } catch (Exception exception) {
                        throw new IllegalStateException(exception);
                    }
                    },
                    (left, right) -> left));
        }
        for (GroupReferenceRegistry.ReferenceDescriptor descriptor :
                GroupReferenceRegistry.descriptors()) {
            for (String writer : descriptor.applicationWriterSymbols()) {
                String[] parts = writer.split("#", 2);
                String source = sourcesByClass.get(parts[0]);
                assertTrue(source != null, writer);
                assertTrue(source.contains(parts[1] + "("), writer);
            }
        }
    }

    @Test
    void resourceInitializationWriterIsRegisteredForEveryAffectedReference() {
        Map<String, Set<String>> writersByReference = GroupReferenceRegistry.descriptors().stream()
            .collect(Collectors.toMap(GroupReferenceRegistry.ReferenceDescriptor::referenceType,
                descriptor -> Set.copyOf(descriptor.applicationWriterSymbols())));

        for (String referenceType : Set.of("wikiSpaceOwners", "wikiPageOwners",
                "sharedFolderOwners", "sharedFileOwners")) {
            assertTrue(writersByReference.get(referenceType)
                .contains("ResourceAuthorizationInitializer#initialize"), referenceType);
        }
        assertTrue(writersByReference.get("resourceAcls")
            .contains("ResourceAuthorizationInitializer#initialize"));
    }
}
