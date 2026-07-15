package com.cwgsyw.platform.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import javax.crypto.Cipher;
import javax.crypto.spec.OAEPParameterSpec;
import javax.crypto.spec.PSource;
import java.security.KeyPairGenerator;
import java.security.spec.MGF1ParameterSpec;
import java.util.Base64;
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

    @Test
    void encryptForClientUsesWebCryptoCompatibleOaepParameters() throws Exception {
        var keyPair = KeyPairGenerator.getInstance("RSA").generateKeyPair();
        String publicKey = Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded());
        String cipherText = crypto.encryptForClient("client-secret", publicKey);
        Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
        cipher.init(Cipher.DECRYPT_MODE, keyPair.getPrivate(), new OAEPParameterSpec(
                "SHA-256", "MGF1", MGF1ParameterSpec.SHA256, PSource.PSpecified.DEFAULT));

        assertThat(cipher.doFinal(Base64.getDecoder().decode(cipherText)))
                .asString()
                .isEqualTo("client-secret");
    }
}
