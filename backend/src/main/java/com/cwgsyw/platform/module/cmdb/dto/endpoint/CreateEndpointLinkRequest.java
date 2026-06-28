package com.cwgsyw.platform.module.cmdb.dto.endpoint;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

/**
 * 创建端点连接请求（spec §8）。端点以 table 行 row_id 锚定。
 */
@Data
public class CreateEndpointLinkRequest {

    /** net | fc | lun */
    @NotBlank
    private String linkType;

    @NotNull
    @JsonAlias("src_instance_id")
    private Long srcInstanceId;
    @NotBlank
    @JsonAlias("src_field_key")
    private String srcFieldKey;
    @NotBlank
    @JsonAlias("src_endpoint_uid")
    private String srcEndpointUid;
    @JsonAlias("src_endpoint_label")
    private String srcEndpointLabel;

    @NotNull
    @JsonAlias("dst_instance_id")
    private Long dstInstanceId;
    @JsonAlias("dst_field_key")
    private String dstFieldKey;
    @JsonAlias("dst_endpoint_uid")
    private String dstEndpointUid;
    @JsonAlias("dst_endpoint_label")
    private String dstEndpointLabel;

    private Map<String, Object> attrs;
}
