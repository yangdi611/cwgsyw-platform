package com.cwgsyw.platform.module.cmdb;

import com.cwgsyw.platform.module.cmdb.dto.attribute.CreateAttributeRequest;
import com.cwgsyw.platform.module.cmdb.dto.attribute.UpdateAttributeRequest;
import com.cwgsyw.platform.module.cmdb.dto.model.UpdateModelRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CmdbMetadataRequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void rejectsInvalidColorAndAttributeBoundariesBeforePersistence() {
        UpdateModelRequest model = new UpdateModelRequest();
        model.setColor("blue");
        assertThat(validator.validate(model)).isNotEmpty();

        CreateAttributeRequest create = new CreateAttributeRequest();
        create.setFieldKey("a".repeat(65));
        create.setName("name");
        create.setGroupId("basic");
        create.setFieldType("singlechar");
        assertThat(validator.validate(create)).isNotEmpty();

        UpdateAttributeRequest update = new UpdateAttributeRequest();
        update.setSortOrder(-1);
        assertThat(validator.validate(update)).isNotEmpty();
    }
}
