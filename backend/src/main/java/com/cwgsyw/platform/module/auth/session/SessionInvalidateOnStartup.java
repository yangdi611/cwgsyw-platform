package com.cwgsyw.platform.module.auth.session;

import com.cwgsyw.platform.config.AuthorizationProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 后端每次启动时清除所有 Redis 会话，强制全部在线用户重新登录。
 * 防止重启后客户端持有旧 token 继续访问，导致功能受限（内存状态/缓存已重置）。
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SessionInvalidateOnStartup {

    private final AuthSessionService authSessionService;
    private final AuthorizationProperties authorizationProperties;

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (!authorizationProperties.isInvalidateSessionsOnStartup()) {
            log.info("[启动] 已保留 Redis 会话，未执行全量会话撤销");
            return;
        }
        try {
            long count = authSessionService.invalidateAllSessions();
            log.info("[启动] 已清除 {} 个 Redis 会话，所有在线用户需重新登录", count);
        } catch (Exception e) {
            log.warn("[启动] 清除 Redis 会话失败（Redis 不可用？），跳过: {}", e.getMessage());
        }
    }
}
