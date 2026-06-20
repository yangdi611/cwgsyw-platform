package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.module.cmdb.dto.CiInstanceBriefVO;
import com.cwgsyw.platform.module.cmdb.dto.association.CiAssociationAttrDefVO;
import com.cwgsyw.platform.module.cmdb.dto.association.CiAssociationKindVO;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import com.cwgsyw.platform.module.cmdb.dto.changes.ChangeHistoryV2VO;
import com.cwgsyw.platform.module.cmdb.dto.history.ChangeHistoryVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.CiInstanceDetailVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.CiInstanceVO;
import com.cwgsyw.platform.module.cmdb.dto.model.CiModelVO;
import com.cwgsyw.platform.module.cmdb.dto.relation.CiRelationVO;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that CMDB VO/DTO classes serialize as camelCase
 * despite global Jackson SNAKE_CASE property-naming-strategy.
 */
class CmdbVoSerializationTest {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule());

    @Test
    void ciInstanceVO_shouldSerializeAsCamelCase() throws Exception {
        CiInstanceVO vo = new CiInstanceVO();
        vo.setModelId("test-model");
        vo.setModelName("Test Model");
        vo.setFieldsData(Map.of("key", "val"));
        vo.setCreatedAt(java.time.LocalDateTime.of(2026, 1, 1, 12, 0));

        String json = objectMapper.writeValueAsString(vo);
        assertThat(json).contains("\"modelId\"");
        assertThat(json).contains("\"modelName\"");
        assertThat(json).contains("\"fieldsData\"");
        assertThat(json).contains("\"createdAt\"");
        assertThat(json).doesNotContain("model_id");
        assertThat(json).doesNotContain("model_name");
        assertThat(json).doesNotContain("fields_data");
        assertThat(json).doesNotContain("created_at");
    }

    @Test
    void ciInstanceDetailVO_shouldSerializeAsCamelCase() throws Exception {
        CiInstanceDetailVO vo = new CiInstanceDetailVO();
        vo.setModelId("test-model");
        vo.setModelName("Test Model");
        vo.setFieldsData(Map.of("key", "val"));
        vo.setCreatedAt(java.time.LocalDateTime.of(2026, 1, 1, 12, 0));
        vo.setUpdatedAt(java.time.LocalDateTime.of(2026, 1, 2, 12, 0));

        String json = objectMapper.writeValueAsString(vo);
        assertThat(json).contains("\"modelId\"");
        assertThat(json).contains("\"fieldsData\"");
        assertThat(json).contains("\"createdAt\"");
        assertThat(json).contains("\"updatedAt\"");
        assertThat(json).doesNotContain("model_id");
        assertThat(json).doesNotContain("created_at");
    }

    @Test
    void ciAttributeVO_shouldSerializeAsCamelCase() throws Exception {
        CiAttributeVO vo = new CiAttributeVO();
        vo.setFieldKey("hostname");
        vo.setFieldType("string");
        vo.setIsRequired(true);
        vo.setIsEditable(true);
        vo.setIsUnique(false);
        vo.setIsBuiltIn(false);
        vo.setIsListShow(true);
        vo.setSortOrder(1);
        vo.setGroupId("g1");
        vo.setGroupName("Basic");
        vo.setDefaultValue("localhost");
        vo.setEnumOptions("opt1,opt2");

        String json = objectMapper.writeValueAsString(vo);
        assertThat(json).contains("\"fieldKey\"");
        assertThat(json).contains("\"fieldType\"");
        assertThat(json).contains("\"isRequired\"");
        assertThat(json).contains("\"isEditable\"");
        assertThat(json).contains("\"isUnique\"");
        assertThat(json).contains("\"isBuiltIn\"");
        assertThat(json).contains("\"isListShow\"");
        assertThat(json).contains("\"sortOrder\"");
        assertThat(json).contains("\"groupId\"");
        assertThat(json).contains("\"groupName\"");
        assertThat(json).contains("\"defaultValue\"");
        assertThat(json).contains("\"enumOptions\"");
        assertThat(json).doesNotContain("field_key");
        assertThat(json).doesNotContain("field_type");
        assertThat(json).doesNotContain("is_required");
        assertThat(json).doesNotContain("sort_order");
    }

    @Test
    void ciModelVO_shouldSerializeAsCamelCase() throws Exception {
        CiModelVO vo = new CiModelVO();
        vo.setDisplayName("Display Name");
        vo.setIsBuiltIn(false);
        vo.setEnable2dView(true);
        vo.setInstanceCount(42);

        String json = objectMapper.writeValueAsString(vo);
        assertThat(json).contains("\"displayName\"");
        assertThat(json).contains("\"isBuiltIn\"");
        assertThat(json).contains("\"enable2dView\"");
        assertThat(json).contains("\"instanceCount\"");
        assertThat(json).doesNotContain("display_name");
        assertThat(json).doesNotContain("is_built_in");
        assertThat(json).doesNotContain("enable_2d_view");
        assertThat(json).doesNotContain("instance_count");
    }

    @Test
    void ciRelationVO_shouldSerializeAsCamelCase() throws Exception {
        CiRelationVO vo = new CiRelationVO();
        vo.setSrcInstanceId(1L);
        vo.setSrcInstanceName("Source");
        vo.setDstInstanceId(2L);
        vo.setDstInstanceName("Dest");
        vo.setAssociationKind("depends_on");

        String json = objectMapper.writeValueAsString(vo);
        assertThat(json).contains("\"srcInstanceId\"");
        assertThat(json).contains("\"srcInstanceName\"");
        assertThat(json).contains("\"dstInstanceId\"");
        assertThat(json).contains("\"dstInstanceName\"");
        assertThat(json).contains("\"associationKind\"");
        assertThat(json).doesNotContain("src_instance_id");
        assertThat(json).doesNotContain("dst_instance_id");
        assertThat(json).doesNotContain("association_kind");
    }

    @Test
    void ciInstanceBriefVO_shouldSerializeAsCamelCase() throws Exception {
        CiInstanceBriefVO vo = new CiInstanceBriefVO();
        vo.setModelId("m1");
        vo.setModelName("Model One");

        String json = objectMapper.writeValueAsString(vo);
        assertThat(json).contains("\"modelId\"");
        assertThat(json).contains("\"modelName\"");
        assertThat(json).doesNotContain("model_id");
    }

    @Test
    void ciAssociationKindVO_shouldSerializeAsCamelCase() throws Exception {
        CiAssociationKindVO vo = new CiAssociationKindVO();
        vo.setIsBuiltIn(true);

        String json = objectMapper.writeValueAsString(vo);
        assertThat(json).contains("\"isBuiltIn\"");
        assertThat(json).doesNotContain("is_built_in");
    }

    @Test
    void ciAssociationAttrDefVO_shouldSerializeAsCamelCase() throws Exception {
        CiAssociationAttrDefVO vo = new CiAssociationAttrDefVO();
        vo.setAssociationKind("depends_on");
        vo.setFieldKey("version");
        vo.setFieldType("string");
        vo.setIsRequired(true);
        vo.setSortOrder(1);
        vo.setEnumOptions("a,b");
        vo.setDefaultValue("1.0");

        String json = objectMapper.writeValueAsString(vo);
        assertThat(json).contains("\"associationKind\"");
        assertThat(json).contains("\"fieldKey\"");
        assertThat(json).contains("\"fieldType\"");
        assertThat(json).contains("\"isRequired\"");
        assertThat(json).contains("\"sortOrder\"");
        assertThat(json).doesNotContain("association_kind");
        assertThat(json).doesNotContain("field_key");
    }

    @Test
    void changeHistoryVO_shouldSerializeAsCamelCase() throws Exception {
        ChangeHistoryVO vo = new ChangeHistoryVO();
        vo.setOperatorId(1L);
        vo.setOperatorName("admin");
        vo.setBeforeJson(Map.of("status", "active"));
        vo.setAfterJson(Map.of("status", "inactive"));
        vo.setChangedFields(List.of("status"));

        String json = objectMapper.writeValueAsString(vo);
        assertThat(json).contains("\"operatorId\"");
        assertThat(json).contains("\"operatorName\"");
        assertThat(json).contains("\"beforeJson\"");
        assertThat(json).contains("\"afterJson\"");
        assertThat(json).contains("\"changedFields\"");
        assertThat(json).doesNotContain("operator_id");
        assertThat(json).doesNotContain("operator_name");
        assertThat(json).doesNotContain("before_json");
        assertThat(json).doesNotContain("after_json");
        assertThat(json).doesNotContain("changed_fields");
    }

    @Test
    void changeHistoryV2VO_shouldSerializeAsCamelCase() throws Exception {
        ChangeHistoryV2VO vo = new ChangeHistoryV2VO();
        vo.setOperatorId(1L);
        vo.setOperatorName("admin");
        vo.setBeforeJson(Map.of("status", "active"));
        vo.setAfterJson(Map.of("status", "inactive"));
        vo.setChangedFields(List.of("status"));

        String json = objectMapper.writeValueAsString(vo);
        assertThat(json).contains("\"operatorId\"");
        assertThat(json).contains("\"operatorName\"");
        assertThat(json).contains("\"beforeJson\"");
        assertThat(json).contains("\"afterJson\"");
        assertThat(json).contains("\"changedFields\"");
    }
}
