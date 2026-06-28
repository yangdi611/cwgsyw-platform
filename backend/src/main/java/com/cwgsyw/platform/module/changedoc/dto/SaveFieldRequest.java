package com.cwgsyw.platform.module.changedoc.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import java.util.List;

@Data
public class SaveFieldRequest {
    private List<FieldItem> fields;

    @Data
    public static class FieldItem {
        private Long id;
        @JsonAlias("field_key")  private String fieldKey;
        private String label;
        @JsonAlias("field_type") private String fieldType;
        @JsonAlias("sort_order") private Integer sortOrder;
        private Boolean required;
        @JsonAlias("in_form")    private Boolean inForm;
        private String placeholder;
    }
}
