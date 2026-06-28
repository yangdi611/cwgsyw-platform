package com.cwgsyw.platform.module.cmdb.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 端口/LUN 级连接（spec §8，P3）。端点以稳定 row_id（端点 UID）锚定，
 * 端口显示名可变而连接不漂移。唯一写入口为 EndpointLinkService。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "ci_endpoint_link", autoResultMap = true)
public class CiEndpointLink extends BaseEntity {

    @TableField("link_type")
    private String linkType;            // net | fc | lun

    @TableField("src_instance_id")
    private Long srcInstanceId;
    @TableField("src_field_key")
    private String srcFieldKey;
    @TableField("src_endpoint_uid")
    private String srcEndpointUid;
    @TableField("src_endpoint_label")
    private String srcEndpointLabel;

    @TableField("dst_instance_id")
    private Long dstInstanceId;
    @TableField("dst_field_key")
    private String dstFieldKey;
    @TableField("dst_endpoint_uid")
    private String dstEndpointUid;
    @TableField("dst_endpoint_label")
    private String dstEndpointLabel;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> attrs = new LinkedHashMap<>();
}
