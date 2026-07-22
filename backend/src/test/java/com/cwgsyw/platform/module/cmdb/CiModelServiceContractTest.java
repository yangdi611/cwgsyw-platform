package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.cmdb.dto.model.CiModelVO;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.cmdb.service.CiAssociationDefService;
import com.cwgsyw.platform.module.cmdb.service.CiModelService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CiModelServiceContractTest {

    @Mock private CiModelMapper ciModelMapper;
    @Mock private CiModelGroupMapper ciModelGroupMapper;
    @Mock private CiAttributeMapper ciAttributeMapper;
    @Mock private CiAttributeGroupMapper ciAttributeGroupMapper;
    @Mock private CiInstanceMapper ciInstanceMapper;
    @Mock private AuditLogMapper auditLogMapper;
    @Mock private CiAssociationDefService ciAssociationDefService;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private CiModelService service;

    @BeforeEach
    void setUp() {
        service = new CiModelService(ciModelMapper, ciModelGroupMapper, ciAttributeMapper,
                ciAttributeGroupMapper, ciInstanceMapper, auditLogMapper,
                ciAssociationDefService, objectMapper);
        CiModel model = new CiModel();
        model.setId(1L);
        model.setModelId("host");
        model.setTenantId("default");
        when(ciModelMapper.findByName("host", "default")).thenReturn(Optional.of(model));
        when(ciModelGroupMapper.selectList(any())).thenReturn(List.of());
        when(ciAttributeGroupMapper.selectList(any())).thenReturn(List.of());
        when(ciInstanceMapper.countByModel("host", "default")).thenReturn(0L);
        when(ciAssociationDefService.listByModel("host", "default")).thenReturn(List.of());
    }

    @Test
    void modelDetailPreservesDrawerVisibilityFlags() throws Exception {
        CiAttribute drawerAttribute = attribute(11L, "hostname", true);
        CiAttribute hiddenAttribute = attribute(12L, "secret", false);
        when(ciAttributeMapper.listByModel("host", "default"))
                .thenReturn(List.of(drawerAttribute, hiddenAttribute));

        CiModelVO result = service.getByCode("host", "default");

        assertThat(result.getAttributes())
                .extracting(attribute -> attribute.getIsDrawerShow())
                .containsExactly(true, false);
        assertThat(objectMapper.writeValueAsString(result.getAttributes().getFirst()))
                .contains("\"isDrawerShow\":true")
                .doesNotContain("is_drawer_show");
    }

    private CiAttribute attribute(Long id, String fieldKey, boolean drawerShow) {
        CiAttribute attribute = new CiAttribute();
        attribute.setId(id);
        attribute.setModelId("host");
        attribute.setFieldKey(fieldKey);
        attribute.setFieldType("singlechar");
        attribute.setIsDrawerShow(drawerShow);
        return attribute;
    }
}
