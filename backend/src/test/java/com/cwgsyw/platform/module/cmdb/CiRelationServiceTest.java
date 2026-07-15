package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.module.cmdb.dto.relation.CreateRelationRequest;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationAttrDefMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiAssociationDefMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import com.cwgsyw.platform.module.cmdb.service.CiFieldSchemaValidator;
import com.cwgsyw.platform.module.cmdb.service.CiRelationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class CiRelationServiceTest {

    @Mock private CiInstanceRelMapper ciInstanceRelMapper;
    @Mock private CiInstanceMapper ciInstanceMapper;
    @Mock private CiAssociationDefMapper ciAssociationDefMapper;
    @Mock private CiAssociationAttrDefMapper ciAssociationAttrDefMapper;
    @Mock private AuditLogMapper auditLogMapper;
    @Mock private ObjectMapper objectMapper;
    @Mock private CiFieldSchemaValidator ciFieldSchemaValidator;

    @Test
    void createRejectsSelfRelationBeforeAnyReadOrWrite() {
        CiRelationService service = new CiRelationService(ciInstanceRelMapper, ciInstanceMapper,
                ciAssociationDefMapper, ciAssociationAttrDefMapper, auditLogMapper, objectMapper,
                ciFieldSchemaValidator);
        CreateRelationRequest request = new CreateRelationRequest();
        request.setDstInstanceId(42L);

        assertThatThrownBy(() -> service.create(42L, request, "default", 1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("不允许实例与自身建立关联关系");

        verifyNoInteractions(ciInstanceRelMapper, ciInstanceMapper, ciAssociationDefMapper,
                ciAssociationAttrDefMapper, auditLogMapper, ciFieldSchemaValidator);
    }
}
