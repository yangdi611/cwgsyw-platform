package com.cwgsyw.platform.module.cmdb.dto.rack;

import lombok.Data;

/**
 * findRackMembers 投影行（spec §5.1）。attrs 以 JSONB 文本返回，Service 端解析 u_start/u_end/asset_no，
 * 避免在 SQL 内对每个字段做 attrs->>'x'（与 resource_pool 聚合风格保持一致：返回原始后 Java 处理）。
 */
@Data
public class RackMemberRow {
    private Long id;
    private String modelId;
    private String name;
    private String status;
    private String modelColor;
    private String modelName;
    /** rack_contains_* 边上记录的 U 位（若关联 metadata 存了 u_start/u_end，可后续扩展；当前取设备 attrs）。 */
    private Integer uStart;
    private Integer uEnd;
    private String assetNo;
    /** 内网 IP（host 类设备 attrs.inner_ip），悬停浮卡展示。 */
    private String innerIp;
    /** 序列号（attrs.sn），悬停浮卡展示。 */
    private String sn;
}
