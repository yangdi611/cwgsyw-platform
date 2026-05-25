package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.common.AuditLogMapper;
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

    @Test
    void createRelation_1_1_dst_occupied_throws_with_ci_name() {
        CiAssociationDef def = new CiAssociationDef();
        def.setDefId("host_belong_app");
        def.setKindId("belong");
        def.setSrcModelId("host");
        def.setDstModelId("app");
        def.setMapping("1:1");
        when(defMapper.selectOne(any())).thenReturn(def);
        when(relMapper.countByDstAndDef("default", "host_belong_app", 5L, -1L)).thenReturn(1);

        CiInstance dstInst = new CiInstance();
        dstInst.setId(5L);
        dstInst.setName("app-server-01");
        dstInst.setModelId("app");
        when(instanceMapper.selectById(5L)).thenReturn(dstInst);

        CiModel dstModel = new CiModel();
        dstModel.setModelId("app");
        dstModel.setName("应用");
        when(modelMapper.selectOne(any())).thenReturn(dstModel);

        CreateRelRequest req = new CreateRelRequest();
        req.setDefId("host_belong_app");
        req.setSrcId(1L);
        req.setDstId(5L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> service.createRelation("default", 1L, req));
        assertTrue(ex.getMessage().contains("app-server-01"), "message must contain dst CI name");
        assertTrue(ex.getMessage().contains("应用"), "message must contain dst model name");
        assertTrue(ex.getMessage().contains("1:1"), "message must contain mapping type");
    }

    @Test
    void createRelation_1_1_src_occupied_throws_with_ci_name() {
        CiAssociationDef def = new CiAssociationDef();
        def.setDefId("host_belong_app");
        def.setKindId("belong");
        def.setSrcModelId("host");
        def.setDstModelId("app");
        def.setMapping("1:1");
        when(defMapper.selectOne(any())).thenReturn(def);
        when(relMapper.countByDstAndDef(anyString(), anyString(), anyLong(), anyLong())).thenReturn(0);
        when(relMapper.countBySrcAndDef("default", "host_belong_app", 1L, -1L)).thenReturn(1);

        CiInstance srcInst = new CiInstance();
        srcInst.setId(1L);
        srcInst.setName("web-server-01");
        srcInst.setModelId("host");
        when(instanceMapper.selectById(1L)).thenReturn(srcInst);

        CiModel srcModel = new CiModel();
        srcModel.setModelId("host");
        srcModel.setName("主机");
        when(modelMapper.selectOne(any())).thenReturn(srcModel);

        CreateRelRequest req = new CreateRelRequest();
        req.setDefId("host_belong_app");
        req.setSrcId(1L);
        req.setDstId(5L);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
            () -> service.createRelation("default", 1L, req));
        assertTrue(ex.getMessage().contains("web-server-01"));
        assertTrue(ex.getMessage().contains("主机"));
    }

    @Test
    void createRelation_nn_no_constraint_passes() {
        CiAssociationDef def = new CiAssociationDef();
        def.setDefId("app_connect_db");
        def.setKindId("connect");
        def.setSrcModelId("app");
        def.setDstModelId("mysql");
        def.setMapping("n:n");

        CiAssociationKind kind = new CiAssociationKind();
        kind.setKindId("connect");
        kind.setName("连接");
        kind.setSrcToDst("连接");
        kind.setDstToSrc("被连接");

        when(defMapper.selectOne(any())).thenReturn(def);
        when(kindMapper.selectOne(any())).thenReturn(kind);
        when(relMapper.insert(any(CiInstanceRel.class))).thenReturn(1);
        when(auditLogMapper.insert(any(com.cwgsyw.platform.common.entity.AuditLog.class))).thenReturn(1);

        CiInstance dstInst = new CiInstance();
        dstInst.setId(10L);
        dstInst.setName("mysql-01");
        dstInst.setModelId("mysql");
        when(instanceMapper.selectById(10L)).thenReturn(dstInst);

        CreateRelRequest req = new CreateRelRequest();
        req.setDefId("app_connect_db");
        req.setSrcId(2L);
        req.setDstId(10L);

        assertDoesNotThrow(() -> service.createRelation("default", 1L, req));
        verify(relMapper).insert(any(CiInstanceRel.class));
    }
}
