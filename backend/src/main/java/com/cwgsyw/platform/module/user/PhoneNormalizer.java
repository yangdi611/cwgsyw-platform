package com.cwgsyw.platform.module.user;

import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.SecurityErrorCode;
import org.springframework.util.StringUtils;

/**
 * 手机号国际化宽松格式标准化（SPEC 12.1）。
 * 输入允许空格、短横线、开头 +；标准化后只保留数字与开头的 +，长度 6-20 位。
 */
public final class PhoneNormalizer {

    private PhoneNormalizer() {}

    public static String normalize(String rawPhone) {
        if (!StringUtils.hasText(rawPhone)) return null;
        String trimmed = rawPhone.trim().replace(" ", "").replace("-", "");
        if (!trimmed.matches("^\\+?[0-9]{6,20}$")) {
            throw new BusinessException(400, SecurityErrorCode.PROFILE_REQUIRED, "手机号格式不正确");
        }
        return trimmed;
    }
}
