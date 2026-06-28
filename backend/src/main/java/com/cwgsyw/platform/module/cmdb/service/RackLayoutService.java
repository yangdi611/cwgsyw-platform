package com.cwgsyw.platform.module.cmdb.service;

import com.cwgsyw.platform.module.cmdb.dto.rack.RackDeviceVO;
import com.cwgsyw.platform.module.cmdb.dto.rack.RackLayoutVO;
import com.cwgsyw.platform.module.cmdb.dto.rack.RackMemberRow;
import com.cwgsyw.platform.module.cmdb.dto.rack.RackWarningVO;
import com.cwgsyw.platform.module.cmdb.entity.CiInstance;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceMapper;
import com.cwgsyw.platform.module.cmdb.mapper.CiInstanceRelMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 2D 机柜视图布局服务（spec §5.1）。只读，不写审计/变更。
 *
 * <p>加载 rack 实例 → 读 rack_height_u → 查 rack_contains_* 直连设备 → 算 U 位告警 → 组 VO。
 * U 位规约：1-based，从下往上；u_start/u_end 含两端。
 */
@Service
@RequiredArgsConstructor
public class RackLayoutService {

    private static final int DEFAULT_RACK_HEIGHT_U = 42;

    private final CiInstanceMapper ciInstanceMapper;
    private final CiInstanceRelMapper ciInstanceRelMapper;

    public RackLayoutVO getLayout(Long rackInstanceId, String tenantId) {
        CiInstance rack = ciInstanceMapper.selectById(rackInstanceId);
        if (rack == null || Boolean.TRUE.equals(rack.getIsDeleted())
                || !tenantId.equals(rack.getTenantId())) {
            throw new IllegalArgumentException("机柜实例不存在或无权访问");
        }
        if (!"rack".equals(rack.getModelId())) {
            throw new IllegalArgumentException("该实例不是机柜（rack）模型");
        }

        Integer rackHeightU = readInt(rack.getFieldsData(), "rack_height_u");
        int height = rackHeightU != null && rackHeightU > 0 ? rackHeightU : DEFAULT_RACK_HEIGHT_U;

        List<RackMemberRow> members = ciInstanceRelMapper.findRackMembers(rackInstanceId, tenantId);

        List<RackDeviceVO> devices = new ArrayList<>();
        List<RackWarningVO> warnings = new ArrayList<>();
        // occupancy[u] = 占用该 U 的设备 id（1-based，索引 0 弃用），用于检测重叠
        Long[] occupancy = new Long[height + 1];

        for (RackMemberRow row : members) {
            RackDeviceVO d = new RackDeviceVO();
            d.setId(row.getId());
            d.setModelId(row.getModelId());
            d.setModelName(row.getModelName());
            d.setName(row.getName());
            d.setStatus(row.getStatus());
            d.setAssetNo(row.getAssetNo());
            d.setModelColor(row.getModelColor());
            d.setUStart(row.getUStart());
            d.setUEnd(row.getUEnd());
            d.setInnerIp(row.getInnerIp());
            d.setSn(row.getSn());
            devices.add(d);

            Integer us = row.getUStart(), ue = row.getUEnd();
            if (us == null || ue == null) {
                warnings.add(new RackWarningVO("missing_u", row.getId(),
                        String.format("设备「%s」未登记 U 位", row.getName())));
                continue;
            }
            if (ue < us) {
                warnings.add(new RackWarningVO("invalid_range", row.getId(),
                        String.format("设备「%s」结束 U(%d) 小于起始 U(%d)", row.getName(), ue, us)));
                continue;
            }
            if (us < 1 || ue > height) {
                warnings.add(new RackWarningVO("out_of_bounds", row.getId(),
                        String.format("设备「%s」U 位 %d-%d 超出机柜范围(1-%d)", row.getName(), us, ue, height)));
                // 越界仍尝试标记界内部分的占用
            }
            for (int u = Math.max(1, us); u <= Math.min(height, ue); u++) {
                if (occupancy[u] != null) {
                    warnings.add(new RackWarningVO("overlap", row.getId(),
                            String.format("设备「%s」与已有设备在 U%d 重叠", row.getName(), u)));
                    break;
                }
            }
            for (int u = Math.max(1, us); u <= Math.min(height, ue); u++) {
                if (occupancy[u] == null) occupancy[u] = row.getId();
            }
        }

        RackLayoutVO vo = new RackLayoutVO();
        vo.setRackId(rackInstanceId);
        vo.setRackName(rack.getName());
        vo.setRackHeightU(height);
        vo.setDevices(devices);
        vo.setWarnings(warnings);
        return vo;
    }

    /** 从 fieldsData 安全读取整型（容忍 Number / 数字字符串 / 空）。 */
    private Integer readInt(Map<String, Object> attrs, String key) {
        if (attrs == null) return null;
        Object v = attrs.get(key);
        if (v == null) return null;
        if (v instanceof Number n) return n.intValue();
        String s = v.toString().trim();
        if (s.isEmpty()) return null;
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
