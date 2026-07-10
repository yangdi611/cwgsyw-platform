package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.module.cmdb.dto.rack.RackLayoutVO;
import com.cwgsyw.platform.module.cmdb.dto.rack.RackMemberRow;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import com.cwgsyw.platform.module.cmdb.service.RackLayoutService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RackLayoutServiceTest {

    @Mock CiInstanceMapper ciInstanceMapper;
    @Mock CiInstanceRelMapper ciInstanceRelMapper;

    @InjectMocks RackLayoutService service;

    private CiInstance rack(Long id, Integer heightU) {
        CiInstance i = new CiInstance();
        i.setId(id);
        i.setName("RACK-01");
        i.setModelId("rack");
        i.setTenantId("default");
        i.setFieldsData(heightU == null ? Map.of() : Map.of("rack_height_u", heightU));
        return i;
    }

    private RackMemberRow member(Long id, String name, Integer us, Integer ue) {
        RackMemberRow r = new RackMemberRow();
        r.setId(id);
        r.setName(name);
        r.setModelId("host");
        r.setModelName("主机");
        r.setModelColor("#1890FF");
        r.setStatus("active");
        r.setUStart(us);
        r.setUEnd(ue);
        return r;
    }

    @Test
    void layout_normal_devices_no_warnings() {
        when(ciInstanceMapper.selectById(1L)).thenReturn(rack(1L, 42));
        when(ciInstanceRelMapper.findRackMembers(1L, "default")).thenReturn(List.of(
                member(10L, "SRV-A", 1, 2),
                member(11L, "SRV-B", 3, 4)
        ));

        RackLayoutVO vo = service.getLayout(1L, "default");

        assertEquals(42, vo.getRackHeightU());
        assertEquals(2, vo.getDevices().size());
        assertTrue(vo.getWarnings().isEmpty(), "正常布局不应有告警");
    }

    @Test
    void layout_default_height_when_missing() {
        when(ciInstanceMapper.selectById(1L)).thenReturn(rack(1L, null));
        when(ciInstanceRelMapper.findRackMembers(1L, "default")).thenReturn(List.of());

        RackLayoutVO vo = service.getLayout(1L, "default");

        assertEquals(42, vo.getRackHeightU(), "缺 rack_height_u 应默认 42U");
    }

    @Test
    void layout_out_of_bounds_warns() {
        when(ciInstanceMapper.selectById(1L)).thenReturn(rack(1L, 42));
        when(ciInstanceRelMapper.findRackMembers(1L, "default")).thenReturn(List.of(
                member(10L, "SRV-X", 45, 46)
        ));

        RackLayoutVO vo = service.getLayout(1L, "default");

        assertEquals(1, vo.getWarnings().size());
        assertEquals("out_of_bounds", vo.getWarnings().get(0).getType());
    }

    @Test
    void layout_overlap_warns() {
        when(ciInstanceMapper.selectById(1L)).thenReturn(rack(1L, 42));
        when(ciInstanceRelMapper.findRackMembers(1L, "default")).thenReturn(List.of(
                member(10L, "SRV-A", 1, 3),
                member(11L, "SRV-B", 2, 4)   // 与 A 在 U2-3 重叠
        ));

        RackLayoutVO vo = service.getLayout(1L, "default");

        assertTrue(vo.getWarnings().stream().anyMatch(w -> "overlap".equals(w.getType())),
                "重叠设备应产生 overlap 告警");
    }

    @Test
    void layout_missing_u_warns() {
        when(ciInstanceMapper.selectById(1L)).thenReturn(rack(1L, 42));
        when(ciInstanceRelMapper.findRackMembers(1L, "default")).thenReturn(List.of(
                member(10L, "SRV-NO-U", null, null)
        ));

        RackLayoutVO vo = service.getLayout(1L, "default");

        assertEquals(1, vo.getWarnings().size());
        assertEquals("missing_u", vo.getWarnings().get(0).getType());
    }

    @Test
    void layout_invalid_range_warns() {
        when(ciInstanceMapper.selectById(1L)).thenReturn(rack(1L, 42));
        when(ciInstanceRelMapper.findRackMembers(1L, "default")).thenReturn(List.of(
                member(10L, "SRV-REV", 5, 3)   // u_end < u_start
        ));

        RackLayoutVO vo = service.getLayout(1L, "default");

        assertEquals("invalid_range", vo.getWarnings().get(0).getType());
    }

    @Test
    void layout_rejects_non_rack_model() {
        CiInstance host = new CiInstance();
        host.setId(2L);
        host.setModelId("host");
        host.setTenantId("default");
        when(ciInstanceMapper.selectById(2L)).thenReturn(host);

        assertThrows(IllegalArgumentException.class, () -> service.getLayout(2L, "default"));
    }

    @Test
    void layout_rejects_missing_or_cross_tenant() {
        when(ciInstanceMapper.selectById(99L)).thenReturn(null);
        assertThrows(IllegalArgumentException.class, () -> service.getLayout(99L, "default"));

        CiInstance other = rack(3L, 42);
        other.setTenantId("other");
        when(ciInstanceMapper.selectById(3L)).thenReturn(other);
        assertThrows(IllegalArgumentException.class, () -> service.getLayout(3L, "default"));
    }
}
