package com.cwgsyw.platform.module.config.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WatermarkConfigRequestValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void acceptsBoundaryValuesAndKnownPositions() {
        WatermarkConfigRequest request = new WatermarkConfigRequest();
        request.setOpacity(0D);
        request.setAngle(-180);
        request.setPosition("top-left");

        assertThat(validator.validate(request)).isEmpty();

        request.setOpacity(1D);
        request.setAngle(180);
        request.setPosition("center");
        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsOutOfRangeAndUnknownValues() {
        WatermarkConfigRequest request = new WatermarkConfigRequest();
        request.setOpacity(1.01D);
        request.setAngle(181);
        request.setPosition("diagonal");

        assertThat(validator.validate(request)).extracting("propertyPath").map(Object::toString)
                .containsExactlyInAnyOrder("opacity", "angle", "position");
    }
}
