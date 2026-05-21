package com.cwgsyw.platform.config;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import java.time.LocalDateTime;
import java.util.Optional;

@Configuration
@Slf4j
public class MyBatisPlusConfig {

    @Bean
    public MetaObjectHandler metaObjectHandler() {
        return new MetaObjectHandler() {
            @Override
            public void insertFill(MetaObject metaObject) {
                this.strictInsertFill(metaObject, "createdAt", LocalDateTime::now, LocalDateTime.class);
                this.strictInsertFill(metaObject, "updatedAt", LocalDateTime::now, LocalDateTime.class);
                getCurrentUserId().ifPresent(uid -> {
                    this.strictInsertFill(metaObject, "createdBy", () -> uid, Long.class);
                    this.strictInsertFill(metaObject, "updatedBy", () -> uid, Long.class);
                });
            }

            @Override
            public void updateFill(MetaObject metaObject) {
                this.strictUpdateFill(metaObject, "updatedAt", LocalDateTime::now, LocalDateTime.class);
                getCurrentUserId().ifPresent(uid ->
                    this.strictUpdateFill(metaObject, "updatedBy", () -> uid, Long.class));
            }

            private Optional<Long> getCurrentUserId() {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.getPrincipal() instanceof SecurityUser su) {
                    return Optional.of(su.getUserId());
                }
                return Optional.empty();
            }
        };
    }
}
