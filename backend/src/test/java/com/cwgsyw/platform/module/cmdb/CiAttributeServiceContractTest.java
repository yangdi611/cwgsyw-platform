package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CiAttributeVO;
import com.cwgsyw.platform.module.cmdb.dto.attribute.CreateAttributeRequest;
import com.cwgsyw.platform.module.cmdb.dto.attribute.UpdateAttributeRequest;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.service.CiAttributeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CiAttributeServiceContractTest {

    @Mock private CiAttributeMapper ciAttributeMapper;
    @Mock private CiAttributeGroupMapper ciAttributeGroupMapper;
    @Mock private CiModelMapper ciModelMapper;
    @Mock private CiInstanceMapper ciInstanceMapper;
    @Mock private AuditLogMapper auditLogMapper;

    private CiAttributeService service;

    @BeforeEach
    void setUp() {
        service = new CiAttributeService(ciAttributeMapper, ciAttributeGroupMapper, ciModelMapper,
                ciInstanceMapper, auditLogMapper, new ObjectMapper());
        CiModel model = new CiModel();
        model.setModelId("host");
        model.setTenantId("default");
        when(ciModelMapper.findByName("host", "default")).thenReturn(Optional.of(model));
    }

    @Test
    void createPersistsAndReturnsDefaultValue() {
        CreateAttributeRequest request = request("environment");
        request.setDefaultValue("production");
        stubCreatePreconditions();

        CiAttributeVO result = service.create("host", request, "default", 1L);

        ArgumentCaptor<CiAttribute> captured = ArgumentCaptor.forClass(CiAttribute.class);
        org.mockito.Mockito.verify(ciAttributeMapper).insert(captured.capture());
        assertThat(captured.getValue().getDefaultValue()).isEqualTo("production");
        assertThat(result.getDefaultValue()).isEqualTo("production");
    }

    @Test
    void updatePersistsAndReturnsDefaultValue() {
        CiAttribute attribute = existingAttribute();
        when(ciAttributeMapper.selectById(7L)).thenReturn(attribute);
        when(ciAttributeGroupMapper.selectList(any())).thenReturn(java.util.List.of());
        UpdateAttributeRequest request = new UpdateAttributeRequest();
        request.setDefaultValue("staging");
        request.setSortOrder(3);

        CiAttributeVO result = service.update("host", 7L, request, "default", 1L);

        assertThat(attribute.getDefaultValue()).isEqualTo("staging");
        assertThat(result.getDefaultValue()).isEqualTo("staging");
        assertThat(result.getSortOrder()).isEqualTo(3);
    }

    @Test
    void listReturnsMappedDefaultValue() {
        CiAttribute attribute = existingAttribute();
        attribute.setDefaultValue("production");
        when(ciAttributeMapper.listByModel("host", "default")).thenReturn(java.util.List.of(attribute));
        when(ciAttributeGroupMapper.selectList(any())).thenReturn(java.util.List.of());

        CiAttributeVO result = service.list("host", "default").getFirst();

        assertThat(result.getDefaultValue()).isEqualTo("production");
    }

    @Test
    void duplicateKeyFromConcurrentCreateReturnsConflictContract() {
        when(ciAttributeMapper.insert(any(CiAttribute.class)))
                .thenThrow(new DuplicateKeyException("uq_ci_attribute_active_field_key"));
        when(ciAttributeMapper.selectCount(any())).thenReturn(0L);
        when(ciAttributeGroupMapper.selectCount(any())).thenReturn(1L);

        assertThatThrownBy(() -> service.create("host", request("environment"), "default", 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("字段标识已存在: environment");
    }

    @Test
    void duplicateEnumOptionIsRejectedBeforeInsert() {
        when(ciAttributeMapper.selectCount(any())).thenReturn(0L);
        CreateAttributeRequest request = request("environment");
        request.setFieldType("enum");
        request.setOption(java.util.List.of(java.util.Map.of("id", "prod", "name", "生产"),
                java.util.Map.of("id", "prod", "name", "重复")));

        assertThatThrownBy(() -> service.create("host", request, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("不可为空或重复");
        org.mockito.Mockito.verify(ciAttributeMapper, org.mockito.Mockito.never()).insert(any(CiAttribute.class));
    }

    @Test
    void updateRejectsRemovingEnumValueUsedByInstance() {
        CiAttribute attribute = existingAttribute();
        attribute.setFieldType("enum");
        attribute.setFieldKey("environment");
        when(ciAttributeMapper.selectById(7L)).thenReturn(attribute);
        CiInstance instance = new CiInstance();
        instance.setTenantId("default");
        instance.setModelId("host");
        instance.setFieldsData(java.util.Map.of("environment", "prod"));
        when(ciInstanceMapper.selectList(any())).thenReturn(java.util.List.of(instance));
        UpdateAttributeRequest request = new UpdateAttributeRequest();
        request.setOption(java.util.List.of(java.util.Map.of("id", "test", "name", "测试")));

        assertThatThrownBy(() -> service.update("host", 7L, request, "default", 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("不能删除选项");
    }

    @Test
    void legacyEnumOptionsAreNormalizedAndDuplicateIdsRejected() {
        when(ciAttributeMapper.selectCount(any())).thenReturn(0L);
        CreateAttributeRequest request = request("environment");
        request.setFieldType("enum");
        request.setEnumOptions("[{\"id\":\"prod\",\"name\":\"生产\"},{\"id\":\"prod\",\"name\":\"重复\"}]");

        assertThatThrownBy(() -> service.create("host", request, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("不可为空或重复");
    }

    @Test
    void updateRejectsRemovingMultiEnumValueUsedByInstance() {
        CiAttribute attribute = existingAttribute();
        attribute.setFieldType("enummulti");
        attribute.setFieldKey("environment");
        when(ciAttributeMapper.selectById(7L)).thenReturn(attribute);
        CiInstance instance = new CiInstance();
        instance.setTenantId("default");
        instance.setModelId("host");
        instance.setFieldsData(java.util.Map.of("environment", "[\"prod\",\"test\"]"));
        when(ciInstanceMapper.selectList(any())).thenReturn(java.util.List.of(instance));
        UpdateAttributeRequest request = new UpdateAttributeRequest();
        request.setOption(java.util.List.of(java.util.Map.of("id", "test", "name", "测试")));

        assertThatThrownBy(() -> service.update("host", 7L, request, "default", 1L))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("prod");
    }

    private CreateAttributeRequest request(String fieldKey) {
        CreateAttributeRequest request = new CreateAttributeRequest();
        request.setFieldKey(fieldKey);
        request.setName("Environment");
        request.setGroupId("basic");
        request.setFieldType("singlechar");
        return request;
    }

    private void stubCreatePreconditions() {
        when(ciAttributeMapper.selectCount(any())).thenReturn(0L);
        when(ciAttributeGroupMapper.selectCount(any())).thenReturn(1L);
        when(ciAttributeGroupMapper.selectList(any())).thenReturn(java.util.List.of());
    }

    private CiAttribute existingAttribute() {
        CiAttribute attribute = new CiAttribute();
        attribute.setId(7L);
        attribute.setTenantId("default");
        attribute.setModelId("host");
        attribute.setFieldKey("environment");
        attribute.setName("Environment");
        attribute.setGroupId("basic");
        attribute.setFieldType("singlechar");
        attribute.setIsDeleted(false);
        attribute.setIsRequired(false);
        attribute.setIsEditable(true);
        attribute.setIsUnique(false);
        attribute.setIsBuiltIn(false);
        attribute.setIsListShow(true);
        attribute.setIsDrawerShow(true);
        attribute.setSortOrder(0);
        return attribute;
    }
}
