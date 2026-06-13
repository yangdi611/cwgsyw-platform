package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.module.cmdb.dto.instance.GroupableAttrVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.TwoDimCellVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.TwoDimGroupVO;
import com.cwgsyw.platform.module.cmdb.dto.instance.TwoDimensionViewVO;
import com.cwgsyw.platform.module.cmdb.entity.CiAttribute;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.entity.CiModel;
import com.cwgsyw.platform.module.cmdb.mapper.CiAttributeMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiModelMapper;
import com.cwgsyw.platform.module.cmdb.service.Ci2DViewService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class Ci2DViewServiceTest {

    @Mock private CiModelMapper ciModelMapper;
    @Mock private CiAttributeMapper ciAttributeMapper;
    @Mock private CiInstanceMapper ciInstanceMapper;

    private Ci2DViewService service;

    @BeforeEach
    void setUp() {
        service = new Ci2DViewService(ciModelMapper, ciAttributeMapper, ciInstanceMapper);
    }

    private CiModel buildModel(String name, boolean enable2dView) {
        CiModel model = new CiModel();
        model.setName(name);
        model.setDisplayName("主机");
        model.setEnable2dView(enable2dView);
        return model;
    }

    private CiAttribute buildAttr(String fieldKey, String name, String fieldType) {
        CiAttribute attr = new CiAttribute();
        attr.setFieldKey(fieldKey);
        attr.setName(name);
        attr.setFieldType(fieldType);
        return attr;
    }

    private CiInstance buildInstance(Long id, String name, String status, String owner, Map<String, Object> fieldsData) {
        CiInstance inst = new CiInstance();
        inst.setId(id);
        inst.setName(name);
        inst.setStatus(status);
        inst.setOwner(owner);
        inst.setFieldsData(fieldsData);
        return inst;
    }

    @Test
    void throwsWhenModelNotFound() {
        when(ciModelMapper.findByName("unknown", "default")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get2DView("unknown", "idc", "default"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("模型不存在");
    }

    @Test
    void throwsWhen2DViewNotEnabled() {
        when(ciModelMapper.findByName("host", "default"))
                .thenReturn(Optional.of(buildModel("host", false)));

        assertThatThrownBy(() -> service.get2DView("host", "idc", "default"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("未启用 2D 视图");
    }

    @Test
    void throwsWhenGroupByAttrNotGroupable() {
        when(ciModelMapper.findByName("host", "default"))
                .thenReturn(Optional.of(buildModel("host", true)));

        CiAttribute intAttr = buildAttr("cpu_cores", "CPU核心数", "int");
        when(ciAttributeMapper.listByModel("host", "default"))
                .thenReturn(List.of(intAttr));

        assertThatThrownBy(() -> service.get2DView("host", "cpu_cores", "default"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("不支持分组");
    }

    @Test
    void groupsInstancesByAttributeValue() {
        when(ciModelMapper.findByName("host", "default"))
                .thenReturn(Optional.of(buildModel("host", true)));

        CiAttribute idcAttr = buildAttr("idc", "机房", "singlechar");
        CiAttribute osAttr = buildAttr("os_type", "操作系统", "enum");
        when(ciAttributeMapper.listByModel("host", "default"))
                .thenReturn(List.of(idcAttr, osAttr));

        List<CiInstance> instances = List.of(
                buildInstance(1L, "server1", "online", "admin", Map.of("idc", "北京机房")),
                buildInstance(2L, "server2", "offline", "admin", Map.of("idc", "上海机房")),
                buildInstance(3L, "server3", "online", "user1", Map.of("idc", "北京机房"))
        );
        when(ciInstanceMapper.selectList(any())).thenReturn(instances);

        TwoDimensionViewVO result = service.get2DView("host", "idc", "default");

        assertThat(result.getModelId()).isEqualTo("host");
        assertThat(result.getModelName()).isEqualTo("主机");
        assertThat(result.getGroupBy()).isEqualTo("idc");

        // Should have 2 groups: 北京机房, 上海机房
        assertThat(result.getGroups()).hasSize(2);

        TwoDimGroupVO beijing = result.getGroups().stream()
                .filter(g -> "北京机房".equals(g.getGroupValue())).findFirst().orElseThrow();
        assertThat(beijing.getInstances()).hasSize(2);
        // Sorted by name within group
        assertThat(beijing.getInstances().get(0).getName()).isEqualTo("server1");
        assertThat(beijing.getInstances().get(1).getName()).isEqualTo("server3");

        TwoDimGroupVO shanghai = result.getGroups().stream()
                .filter(g -> "上海机房".equals(g.getGroupValue())).findFirst().orElseThrow();
        assertThat(shanghai.getInstances()).hasSize(1);
        assertThat(shanghai.getInstances().get(0).getName()).isEqualTo("server2");

        // Groupable attrs should include both singlechar and enum
        assertThat(result.getGroupableAttrs()).hasSize(2);
        assertThat(result.getGroupableAttrs().stream().map(GroupableAttrVO::getFieldKey))
                .containsExactly("idc", "os_type");
    }

    @Test
    void nullGroupValueFallsBackToUngrouped() {
        when(ciModelMapper.findByName("host", "default"))
                .thenReturn(Optional.of(buildModel("host", true)));

        CiAttribute idcAttr = buildAttr("idc", "机房", "singlechar");
        when(ciAttributeMapper.listByModel("host", "default"))
                .thenReturn(List.of(idcAttr));

        List<CiInstance> instances = List.of(
                buildInstance(1L, "server1", "online", "admin", Map.of("idc", "北京机房")),
                buildInstance(2L, "server2", "online", "admin", null),
                buildInstance(3L, "server3", "online", "admin", Map.of())
        );
        when(ciInstanceMapper.selectList(any())).thenReturn(instances);

        TwoDimensionViewVO result = service.get2DView("host", "idc", "default");

        // Should have 2 groups: 北京机房 and __未分组__
        assertThat(result.getGroups()).hasSize(2);

        TwoDimGroupVO ungrouped = result.getGroups().stream()
                .filter(g -> "__未分组__".equals(g.getGroupValue())).findFirst().orElseThrow();
        assertThat(ungrouped.getInstances()).hasSize(2);
    }
}
