package com.cwgsyw.platform.module.cmdb.dto.rack;

import lombok.Data;

import java.util.List;

/**
 * 2D 机柜视图布局结果（spec §5.2）。机柜 U 位从下往上（1U 底，rackHeightU 顶）。
 */
@Data
public class RackLayoutVO {
    private Long rackId;
    private String rackName;
    /** 机柜总 U 数（来自 rack 实例 attrs.rack_height_u；缺失时为 null，前端默认 42U）。 */
    private Integer rackHeightU;
    private List<RackDeviceVO> devices;
    /** U 位越界 / 区间重叠等告警。 */
    private List<RackWarningVO> warnings;
}
