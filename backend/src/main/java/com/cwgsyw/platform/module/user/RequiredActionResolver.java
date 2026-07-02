package com.cwgsyw.platform.module.user;

import com.cwgsyw.platform.config.SecurityProperties;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

/**
 * 计算用户当前必须完成的强制动作（SPEC 8.2）。
 * CHANGE_PASSWORD：mustChangePassword == true。
 * COMPLETE_PROFILE：email/phone 缺失或 profileCompleted == false；
 *   历史用户（非强制迁移）不受 profileCompleted=false 影响，除非配置打开。
 */
@Component
@RequiredArgsConstructor
public class RequiredActionResolver {

    public static final String CHANGE_PASSWORD = "CHANGE_PASSWORD";
    public static final String COMPLETE_PROFILE = "COMPLETE_PROFILE";

    private final SecurityProperties securityProperties;

    public List<String> resolve(User user) {
        List<String> actions = new ArrayList<>();
        if (Boolean.TRUE.equals(user.getMustChangePassword())) {
            actions.add(CHANGE_PASSWORD);
        }
        if (isProfileIncomplete(user)) {
            actions.add(COMPLETE_PROFILE);
        }
        return actions;
    }

    private boolean isProfileIncomplete(User user) {
        boolean missingContact = !StringUtils.hasText(user.getEmail()) || !StringUtils.hasText(user.getPhone());
        boolean notCompleted = !Boolean.TRUE.equals(user.getProfileCompleted());
        boolean incomplete = missingContact || notCompleted;
        if (!incomplete) return false;

        // mustChangePassword=true 是"新建用户"的信号（create 时总是置为 true）；
        // 历史用户迁移后 mustChangePassword=false，默认不强制补全资料，除非显式打开配置（SPEC 8.2/17.2）。
        boolean isNewUser = Boolean.TRUE.equals(user.getMustChangePassword());
        if (isNewUser) return true;
        return securityProperties.getAccount().isForceExistingUsersCompleteProfile();
    }
}
