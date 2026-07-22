package com.cwgsyw.platform.module.cmdb.dto.attribute;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class CreateAttributeRequest {
    @JsonProperty("fieldKey")
    @NotBlank @Size(max = 64) @Pattern(regexp = "^[a-z][a-z0-9_]*$")
    private String fieldKey;

    @JsonProperty("name")
    @NotBlank @Size(max = 128)
    private String name;

    @JsonProperty("groupId")
    @NotBlank @Size(max = 64)
    private String groupId;

    @JsonProperty("fieldType")
    @NotBlank @Size(max = 32)
    private String fieldType;

    private Boolean isRequired = false;
    private Boolean isEditable = true;
    private Boolean isUnique = false;
    private Boolean isListShow = false;
    private Boolean isDrawerShow = false;
    private String defaultValue;

    /**
     * Option JSONB. enum/enummulti 为数组 [{"id","name","is_default"}]；
     * table 为对象 {"schema_version","row_key","columns":[...]}（§4.1）。类型放宽为 Object。
     */
    @JsonProperty("option")
    private Object option;

    /**
     * @deprecated Use {@link #option} instead. This field accepts the old enumOptions string.
     */
    @Deprecated
    @JsonProperty("enumOptions")
    private String enumOptions;

    @PositiveOrZero
    private Integer sortOrder = 0;
}
