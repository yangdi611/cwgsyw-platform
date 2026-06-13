package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.module.cmdb.dto.CreateRelRequest;
import com.cwgsyw.platform.module.cmdb.entity.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CiInstanceRelServiceTest {

    @Mock CiInstanceRelMapper relMapper;
    @Mock CiAssociationDefMapper defMapper;
    @Mock CiAssociationKindMapper kindMapper;
    @Mock CiInstanceMapper instanceMapper;
    @Mock CiModelMapper modelMapper;
    @Mock AuditLogMapper auditLogMapper;

    @InjectMocks CiInstanceRelService service;

    private CiInstance inst(Long id, String name, String modelId) {
        CiInstance i = new CiInstance();
        i.setId(id); i.setName(name); i.setModelId(modelId);
        return i;
    }

    private CiModel model(String modelId, String name) {
        CiModel m = new CiModel();
        m.setModelId(modelId); m.setName(name);
        return m;
    }

    @Test
    void createRelation_1_1_dst_occupied_throws_with_ci_name() {
        CiAssociationDef def = new CiAssociationDef();
        def.setDefId("host_belong_app"); def.setKindId("belong");
        def.setSrcModelId("host"); def.setDstModelId("app"); def.setMapping("1:1");
        when(defMapper.selectOne(any())).thenReturn(def);

        // Model-type validation: selectOne called for srcCheck then dstCheck
        when(instanceMapper.selectOne(any()))
            .thenReturn(inst(1L, "web-server-01", "host"))
            .thenReturn(inst(5L, "app-server-01", "app"));

        // Cardinality validation: dst already occupied
        when(relMapper.countByDstAndDef("default", "host_belong_app", 5L, -1L)).thenReturn(1);
        when(instanceMapper.selectById(5L)).thenReturn(inst(5L, "app-server-01", "app"));
        when(modelMapper.selectOne(any())).thenReturn(model("app", "应用"));

        CreateRelRequest req = new CreateRelRequest();
        req.setDefId("host_belong_app"); req.setSrcId(1L); req.setDstId(5L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> service.createRelation("default", 1L, req));
        assertTrue(ex.getMessage().contains("app-server-01"), "message must contain dst CI name");
        assertTrue(ex.getMessage().contains("应用"), "message must contain dst model name");
        assertTrue(ex.getMessage().contains("1:1"), "message must contain mapping type");
    }

    @Test
    void createRelation_1_1_src_occupied_throws_with_ci_name() {
        CiAssociationDef def = new CiAssociationDef();
        def.setDefId("host_belong_app"); def.setKindId("belong");
        def.setSrcModelId("host"); def.setDstModelId("app"); def.setMapping("1:1");
        when(defMapper.selectOne(any())).thenReturn(def);

        // Model-type validation
        when(instanceMapper.selectOne(any()))
            .thenReturn(inst(1L, "web-server-01", "host"))
            .thenReturn(inst(5L, "app-server-01", "app"));

        // Cardinality: dst free, src occupied
        when(relMapper.countByDstAndDef(anyString(), anyString(), anyLong(), anyLong())).thenReturn(0);
        when(relMapper.countBySrcAndDef("default", "host_belong_app", 1L, -1L)).thenReturn(1);
        when(instanceMapper.selectById(1L)).thenReturn(inst(1L, "web-server-01", "host"));
        when(modelMapper.selectOne(any())).thenReturn(model("host", "主机"));

        CreateRelRequest req = new CreateRelRequest();
        req.setDefId("host_belong_app"); req.setSrcId(1L); req.setDstId(5L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> service.createRelation("default", 1L, req));
        assertTrue(ex.getMessage().contains("web-server-01"));
        assertTrue(ex.getMessage().contains("主机"));
        assertTrue(ex.getMessage().contains("1:1"));
    }

    @Test
    void createRelation_nn_no_constraint_passes() {
        CiAssociationDef def = new CiAssociationDef();
        def.setDefId("app_connect_db"); def.setKindId("connect");
        def.setSrcModelId("app"); def.setDstModelId("mysql"); def.setMapping("n:n");

        CiAssociationKind kind = new CiAssociationKind();
        kind.setKindId("connect"); kind.setName("连接");
        kind.setSrcToDst("连接"); kind.setDstToSrc("被连接");

        when(defMapper.selectOne(any())).thenReturn(def);

        // Model-type validation
        when(instanceMapper.selectOne(any()))
            .thenReturn(inst(2L, "my-app", "app"))
            .thenReturn(inst(10L, "mysql-01", "mysql"));

        when(kindMapper.selectOne(any())).thenReturn(kind);
        when(relMapper.insert(any(CiInstanceRel.class))).thenReturn(1);
        when(auditLogMapper.insert(any(AuditLog.class))).thenReturn(1);
        when(instanceMapper.selectById(10L)).thenReturn(inst(10L, "mysql-01", "mysql"));
        when(modelMapper.selectOne(any())).thenReturn(model("mysql", "MySQL"));

        CreateRelRequest req = new CreateRelRequest();
        req.setDefId("app_connect_db"); req.setSrcId(2L); req.setDstId(10L);

        assertDoesNotThrow(() -> service.createRelation("default", 1L, req));
        verify(relMapper).insert(any(CiInstanceRel.class));
    }
}
