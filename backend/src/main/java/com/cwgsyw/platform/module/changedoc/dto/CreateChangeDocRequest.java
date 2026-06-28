package com.cwgsyw.platform.module.changedoc.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;
import java.util.Map;

@Data
public class CreateChangeDocRequest {
    @JsonAlias("change_no")               private String changeNo;
    private String title;
    @JsonAlias("application_template_id") private Long applicationTemplateId;
    @JsonAlias("plan_template_id")        private Long planTemplateId;
    @JsonAlias("fields_data")             private Map<String, String> fieldsData;
}
