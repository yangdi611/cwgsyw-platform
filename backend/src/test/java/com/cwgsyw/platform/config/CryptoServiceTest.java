package com.cwgsyw.platform.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class CryptoServiceTest {
    private CryptoService crypto;

    @BeforeEach
    void setUp() {
        crypto = new CryptoService("dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleTEyMzQ=");
    }

    @Test
    void encryptAndDecrypt() {
        String plain = "my-secret-password";
        String enc = crypto.encrypt(plain);
        assertThat(enc).isNotBlank().isNotEqualTo(plain);
        assertThat(crypto.decrypt(enc)).isEqualTo(plain);
    }

    @Test
    void sameInputProducesDifferentCiphertext() {
        String plain = "password123";
        String enc1 = crypto.encrypt(plain);
        String enc2 = crypto.encrypt(plain);
        assertThat(enc1).isNotEqualTo(enc2);
        assertThat(crypto.decrypt(enc1)).isEqualTo(plain);
        assertThat(crypto.decrypt(enc2)).isEqualTo(plain);
    }
}
