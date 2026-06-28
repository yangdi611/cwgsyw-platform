package com.cwgsyw.platform.module.cmdb.dto.rack;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * 机柜内一台设备的占位信息（spec §5.2）。
 */
@Data
public class RackDeviceVO {
    private Long id;
    private String modelId;
    private String modelName;
    private String name;
    private String status;
    private String assetNo;
    /**
     * 起始 U 位（1-based，含）。null 表示设备未登记 U 位，前端渲染为「未定位」列表。
     * 显式 getter + @JsonProperty 钉死 JSON 名为 uStart——LowerCamelCaseStrategy 对 Lombok 生成的
     * getUStart() 会推断成 "ustart"（连续大写陷阱），标在字段上会同时产出两个键，必须标在 getter 上。
     */
    private Integer uStart;
    /** 结束 U 位（含）。 */
    private Integer uEnd;
    /** 模型配色（ci_model.color），机柜块底色。 */
    private String modelColor;

    @JsonProperty("uStart")
    public Integer getUStart() {
        return uStart;
    }

    @JsonProperty("uEnd")
    public Integer getUEnd() {
        return uEnd;
    }
}
