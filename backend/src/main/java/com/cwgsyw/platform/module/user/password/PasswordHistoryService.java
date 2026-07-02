package com.cwgsyw.platform.module.user.password;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.SecurityErrorCode;
import com.cwgsyw.platform.module.user.UserPasswordHistoryMapper;
import com.cwgsyw.platform.module.user.entity.UserPasswordHistory;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 密码历史校验与记录（SPEC 9.3-9.4）。
 * 新密码不能与最近 N 次密码历史重复，且创建/重置时的初始密码也写入历史，
 * 因此首次改密天然覆盖“不能等于初始密码”。
 */
@Service
@RequiredArgsConstructor
public class PasswordHistoryService {

    private final UserPasswordHistoryMapper passwordHistoryMapper;
    private final PasswordEncoder passwordEncoder;

    /** 校验新密码是否与最近 historyCount 次历史密码（含初始密码）重复，命中则抛出 PASSWORD_REUSED。 */
    public void assertNotRecentlyUsed(Long userId, String newPassword, int historyCount) {
        if (matchesAnyRecent(userId, newPassword, historyCount)) {
            throw new BusinessException(400, SecurityErrorCode.PASSWORD_REUSED, "不能使用最近使用过的密码");
        }
    }

    public boolean matchesAnyRecent(Long userId, String rawPassword, int historyCount) {
        List<UserPasswordHistory> recent = recentHistory(userId, historyCount);
        for (UserPasswordHistory history : recent) {
            if (passwordEncoder.matches(rawPassword, history.getPasswordHash())) {
                return true;
            }
        }
        return false;
    }

    public void record(Long userId, String tenantId, String passwordHash, PasswordHistorySource source, Long operatorId) {
        UserPasswordHistory history = new UserPasswordHistory();
        history.setUserId(userId);
        history.setTenantId(tenantId);
        history.setPasswordHash(passwordHash);
        history.setSource(source.name());
        history.setCreatedBy(operatorId);
        passwordHistoryMapper.insert(history);
    }

    private List<UserPasswordHistory> recentHistory(Long userId, int historyCount) {
        Page<UserPasswordHistory> page = passwordHistoryMapper.selectPage(
            new Page<>(1, historyCount, false),
            new LambdaQueryWrapper<UserPasswordHistory>()
                .eq(UserPasswordHistory::getUserId, userId)
                .orderByDesc(UserPasswordHistory::getCreatedAt));
        return page.getRecords();
    }
}
