package com.cwgsyw.platform.module.cmdb.dto.rack;

import lombok.Data;

/**
 * 机柜布局告警（spec §5.1 第 5 步）。
 */
@Data
public class RackWarningVO {
    /** 告警类型：out_of_bounds（U 越界）/ overlap（区间重叠）/ missing_u（未登记 U 位）/ invalid_range（u_end<u_start）。 */
    private String type;
    /** 涉及的设备 id（overlap 取其中一台；前端可据此高亮）。 */
    private Long instanceId;
    private String message;

    public RackWarningVO() {}

    public RackWarningVO(String type, Long instanceId, String message) {
        this.type = type;
        this.instanceId = instanceId;
        this.message = message;
    }
}
