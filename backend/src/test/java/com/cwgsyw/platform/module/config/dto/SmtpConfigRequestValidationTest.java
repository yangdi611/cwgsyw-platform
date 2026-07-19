package com.cwgsyw.platform.module.config.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SmtpConfigRequestValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void validHostsAndBoundaryFieldsPass() {
        for (String host : new String[] {"", "mailpit", "smtp.example.test", "127.0.0.1", "[::1]"}) {
            SmtpConfigRequest request = request(host, 1, "sender@example.test");
            assertThat(validator.validate(request)).as(host).isEmpty();
        }
        assertThat(validator.validate(request("smtp.example.test", 65535, ""))).isEmpty();
    }

    @Test
    void invalidHostsPortsAndSenderAddressesFail() {
        for (String host : new String[] {
            "bad host with spaces", "https://smtp.example.test", "smtp.example.test/path",
            ".smtp.example.test", "smtp..example.test", "-smtp.example.test", "smtp-.example.test"
        }) {
            assertThat(validator.validate(request(host, 25, "sender@example.test"))).as(host).isNotEmpty();
        }
        assertThat(validator.validate(request("smtp.example.test", 0, "sender@example.test"))).isNotEmpty();
        assertThat(validator.validate(request("smtp.example.test", 65536, "sender@example.test"))).isNotEmpty();
        assertThat(validator.validate(request("smtp.example.test", 25, "not-an-email"))).isNotEmpty();
    }

    private SmtpConfigRequest request(String host, Integer port, String from) {
        SmtpConfigRequest request = new SmtpConfigRequest();
        request.setHost(host);
        request.setPort(port);
        request.setFrom(from);
        return request;
    }
}
