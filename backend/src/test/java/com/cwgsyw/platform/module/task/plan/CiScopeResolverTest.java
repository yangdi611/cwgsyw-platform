package com.cwgsyw.platform.module.task.plan;

import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.entity.CiModelGroup;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelGroupMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeRequest;
import com.cwgsyw.platform.module.task.plan.dto.CiScopeSelection;
import com.cwgsyw.platform.module.task.plan.service.CiScopeResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CiScopeResolverTest {
    private final CiModelGroupMapper groupMapper = mock(CiModelGroupMapper.class);
    private final CiModelMapper modelMapper = mock(CiModelMapper.class);
    private final CiInstanceMapper instanceMapper = mock(CiInstanceMapper.class);
    private final CiScopeResolver resolver = new CiScopeResolver(groupMapper, modelMapper, instanceMapper);

    @BeforeEach
    void setUp() {
        CiModelGroup group = new CiModelGroup();
        group.setCode("database"); group.setName("数据库");
        CiModel mysql = new CiModel();
        mysql.setModelId("mysql"); mysql.setName("MySQL"); mysql.setGroupCode("database");
        CiModel redis = new CiModel();
        redis.setModelId("redis"); redis.setName("Redis"); redis.setGroupCode("database");
        CiInstance mysqlOne = instance(1L, "mysql-prod", "mysql", "active");
        CiInstance redisOne = instance(2L, "redis-prod", "redis", "active");
        when(groupMapper.selectList(any())).thenReturn(List.of(group));
        when(modelMapper.selectList(any())).thenReturn(List.of(mysql, redis));
        when(instanceMapper.selectList(any())).thenReturn(List.of(mysqlOne, redisOne));
    }

    @Test
    void removesSelectionsCoveredByParentAndDeduplicatesInstances() {
        var result = resolver.resolve("default", new CiScopeRequest(List.of(
            new CiScopeSelection("model_group", "database"),
            new CiScopeSelection("model", "mysql"),
            new CiScopeSelection("instance", "1")
        ), Map.of("status", List.of("active")), 100));

        assertThat(result.total()).isEqualTo(2);
        assertThat(result.selections()).containsExactly(new CiScopeSelection("model_group", "database"));
        assertThat(result.warnings()).hasSize(2);
    }

    private CiInstance instance(Long id, String name, String model, String status) {
        CiInstance value = new CiInstance();
        value.setId(id); value.setName(name); value.setModelId(model); value.setStatus(status);
        return value;
    }
}
