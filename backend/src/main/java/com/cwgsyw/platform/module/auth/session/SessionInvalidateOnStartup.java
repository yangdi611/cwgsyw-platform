package com.cwgsyw.platform.module.auth.session;

import com.cwgsyw.platform.config.AuthorizationProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 只有显式启用时才递增全局会话 epoch，强制旧会话在下一次请求重新登录。
 * 不删除 Redis session key，普通重启不会影响在线用户或测试会话。
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
            log.info("[启动] 已保留 Redis 会话，未递增全局会话 epoch");
            return;
        }
        try {
            long epoch = authSessionService.advanceGlobalSessionEpoch();
            log.info("[启动] 已递增全局会话 epoch 至 {}，旧会话将在下一次请求重新登录", epoch);
        } catch (Exception e) {
            log.warn("[启动] 递增全局会话 epoch 失败（Redis 不可用？），跳过: {}", e.getMessage());
        }
    }
}
