package com.cwgsyw.platform.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

@Service
public class CryptoService {
    private static final int GCM_NONCE_LENGTH = 12;
    private static final int GCM_TAG_LENGTH = 128;
    private final SecretKey key;

    public CryptoService(@Value("${encrypt.key}") String base64Key) {
        byte[] keyBytes = Base64.getDecoder().decode(base64Key);
        if (keyBytes.length != 32) throw new IllegalArgumentException("ENCRYPT_KEY must be 32 bytes (Base64-encoded)");
        this.key = new SecretKeySpec(keyBytes, "AES");
    }

    public String encrypt(String plaintext) {
        try {
            byte[] nonce = new byte[GCM_NONCE_LENGTH];
            new SecureRandom().nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH, nonce));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes());
            byte[] result = new byte[GCM_NONCE_LENGTH + ciphertext.length];
            System.arraycopy(nonce, 0, result, 0, GCM_NONCE_LENGTH);
            System.arraycopy(ciphertext, 0, result, GCM_NONCE_LENGTH, ciphertext.length);
            return Base64.getEncoder().encodeToString(result);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }

    public String decrypt(String cipherBase64) {
        try {
            byte[] data = Base64.getDecoder().decode(cipherBase64);
            byte[] nonce = new byte[GCM_NONCE_LENGTH];
            System.arraycopy(data, 0, nonce, 0, GCM_NONCE_LENGTH);
            byte[] ciphertext = new byte[data.length - GCM_NONCE_LENGTH];
            System.arraycopy(data, GCM_NONCE_LENGTH, ciphertext, 0, ciphertext.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH, nonce));
            return new String(cipher.doFinal(ciphertext));
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }

    /**
     * Envelope encryption: encrypt plaintext with client's RSA public key so plaintext
     * never travels over the wire. Used by password reveal endpoint to defend against
     * man-in-the-middle attacks in HTTP dev environments.
     *
     * @param plaintext the secret to encrypt
     * @param clientPublicKeyBase64 client's RSA public key (SPKI DER, Base64-encoded, no PEM headers)
     * @return Base64-encoded RSA ciphertext that only the client's private key can decrypt
     */
    public String encryptForClient(String plaintext, String clientPublicKeyBase64) {
        try {
            byte[] keyBytes = Base64.getDecoder().decode(clientPublicKeyBase64);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
            KeyFactory kf = KeyFactory.getInstance("RSA");
            PublicKey pubKey = kf.generatePublic(spec);

            Cipher cipher = Cipher.getInstance("RSA/ECB/OAEPWithSHA-256AndMGF1Padding");
            cipher.init(Cipher.ENCRYPT_MODE, pubKey);
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(encrypted);
        } catch (Exception e) {
            throw new RuntimeException("Client-side encryption failed", e);
        }
    }
}
