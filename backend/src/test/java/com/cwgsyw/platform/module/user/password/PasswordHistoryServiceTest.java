package com.cwgsyw.platform.module.user.password;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.BusinessException;
import com.cwgsyw.platform.common.SecurityErrorCode;
import com.cwgsyw.platform.module.user.UserPasswordHistoryMapper;
import com.cwgsyw.platform.module.user.entity.UserPasswordHistory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * 密码历史校验与记录（SPEC 18.1 第8点：与历史密码重复失败）。
 */
@ExtendWith(MockitoExtension.class)
class PasswordHistoryServiceTest {

    @Mock UserPasswordHistoryMapper passwordHistoryMapper;
    @Mock PasswordEncoder passwordEncoder;

    @InjectMocks PasswordHistoryService service;

    private UserPasswordHistory history(String hash) {
        UserPasswordHistory h = new UserPasswordHistory();
        h.setPasswordHash(hash);
        return h;
    }

    @Test
    void matchesRecentHistory_throwsPasswordReused() {
        Page<UserPasswordHistory> page = new Page<>(1, 5, false);
        page.setRecords(List.of(history("hash-1"), history("hash-2")));
        when(passwordHistoryMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
            .thenReturn(page);
        when(passwordEncoder.matches("NewPwd#2026", "hash-1")).thenReturn(false);
        when(passwordEncoder.matches("NewPwd#2026", "hash-2")).thenReturn(true);

        BusinessException ex = assertThrows(BusinessException.class,
            () -> service.assertNotRecentlyUsed(1L, "NewPwd#2026", 5));
        assertEquals(SecurityErrorCode.PASSWORD_REUSED, ex.getErrorCode());
    }

    @Test
    void equalsInitialPasswordInHistory_throwsPasswordReused() {
        // 创建用户时的初始密码 hash 也在历史表中，因此首次改密天然覆盖“不能等于初始密码”
        Page<UserPasswordHistory> page = new Page<>(1, 5, false);
        page.setRecords(List.of(history("initial-hash")));
        when(passwordHistoryMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
            .thenReturn(page);
        when(passwordEncoder.matches("InitPwd#123", "initial-hash")).thenReturn(true);

        assertThrows(BusinessException.class,
            () -> service.assertNotRecentlyUsed(1L, "InitPwd#123", 5));
    }

    @Test
    void noMatch_doesNotThrow() {
        Page<UserPasswordHistory> page = new Page<>(1, 5, false);
        page.setRecords(List.of(history("hash-1")));
        when(passwordHistoryMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
            .thenReturn(page);
        when(passwordEncoder.matches("BrandNew#2026", "hash-1")).thenReturn(false);

        assertDoesNotThrow(() -> service.assertNotRecentlyUsed(1L, "BrandNew#2026", 5));
    }

    @Test
    void record_insertsHistoryWithSource() {
        ArgumentCaptor<UserPasswordHistory> captor = ArgumentCaptor.forClass(UserPasswordHistory.class);

        service.record(1L, "default", "encoded-hash", PasswordHistorySource.CREATE_USER, 9L);

        org.mockito.Mockito.verify(passwordHistoryMapper).insert(captor.capture());
        UserPasswordHistory saved = captor.getValue();
        assertEquals(1L, saved.getUserId());
        assertEquals("default", saved.getTenantId());
        assertEquals("encoded-hash", saved.getPasswordHash());
        assertEquals("CREATE_USER", saved.getSource());
        assertEquals(9L, saved.getCreatedBy());
    }
}
