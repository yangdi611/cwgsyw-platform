package com.cwgsyw.platform.module.changedoc.dto;

import lombok.Data;
import java.util.List;

@Data
public class SaveFieldRequest {
    private List<FieldItem> fields;

    @Data
    public static class FieldItem {
        private Long id;
        private String fieldKey;
        private String label;
        private String fieldType;
        private Integer sortOrder;
        private Boolean required;
        private Boolean inForm;
        private String placeholder;
    }
}
