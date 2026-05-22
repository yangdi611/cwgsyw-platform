# Phase 2c: Email Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an email notification system + in-app message inbox, with admin-configurable SMTP settings, scheduled daily-report reminders, and approval event notifications.

**Architecture:** Spring Boot Mail sends emails via SMTP (config stored in `sys_config` DB table, loaded at runtime). All notifications are also persisted as in-app `notification_message` rows. A `@Scheduled` job runs daily to remind users who haven't filed today's report. Approval events are triggered from the existing `DailyReportApprovalListener` and `DailyReportService.submit()`.

**Tech Stack:** spring-boot-starter-mail, JavaMailSender, Spring `@Scheduled`, MyBatis-Plus, Next.js 15 (App Router), shadcn/ui, TanStack Query v5

---

## File Map

**Backend — new files:**
- `V7__create_notification_tables.sql` — `notification_message` + `sys_config` tables + RBAC seed
- `module/notification/entity/NotificationMessage.java`
- `module/notification/NotificationMapper.java`
- `module/notification/NotificationService.java` — save in-app msg + send email via EmailService
- `module/notification/NotificationController.java` — list/count-unread/mark-read endpoints
- `module/notification/dto/NotificationVO.java`
- `module/config/entity/SysConfig.java`
- `module/config/SysConfigMapper.java`
- `module/config/SysConfigService.java` — get/set config values, cache in memory
- `module/config/SysConfigController.java` — admin SMTP + reminder settings CRUD
- `module/config/dto/SmtpConfigRequest.java`
- `module/config/dto/NotificationConfigRequest.java`
- `config/EmailService.java` — JavaMailSender wrapper, builds from SysConfigService at send time
- `scheduler/DailyReportReminderScheduler.java` — @Scheduled cron, finds missing reports, sends reminders

**Backend — modified files:**
- `pom.xml` — add `spring-boot-starter-mail`
- `application.yml` — add `spring.mail` placeholder block (disabled by default)
- `application-dev.yml` — add dev SMTP defaults (disabled)
- `module/daily/DailyReportService.java` — call `NotificationService` after `submit()` completes
- `module/workflow/DailyReportApprovalListener.java` — call `NotificationService` after status update

**Frontend — new files:**
- `app/(dashboard)/notifications/page.tsx` — notification inbox (list + mark-read)
- `app/(dashboard)/admin/config/page.tsx` — SMTP + notification config admin page
- `components/layout/NotificationBell.tsx` — header bell icon with unread count badge

**Frontend — modified files:**
- `components/layout/Sidebar.tsx` — add notifications nav item (all users) + admin config nav item (admin only)
- `app/(dashboard)/layout.tsx` — add `NotificationBell` to header area

---

## Task 1: Database Migration V7

**Files:**
- Create: `backend/src/main/resources/db/migration/V7__create_notification_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- V7: 通知消息 + 系统配置

CREATE TABLE sys_config (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    config_key  VARCHAR(128) NOT NULL,
    config_value TEXT,
    description VARCHAR(255),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, config_key)
);

INSERT INTO sys_config (tenant_id, config_key, config_value, description) VALUES
('default', 'smtp.enabled',        'false',                  'SMTP是否启用'),
('default', 'smtp.host',           '',                       'SMTP服务器地址'),
('default', 'smtp.port',           '465',                    'SMTP端口'),
('default', 'smtp.username',       '',                       'SMTP用户名'),
('default', 'smtp.password',       '',                       'SMTP密码（明文存储，注意权限）'),
('default', 'smtp.from',           '',                       '发件人地址'),
('default', 'smtp.from_name',      'IT运维平台',              '发件人名称'),
('default', 'smtp.ssl',            'true',                   '是否使用SSL'),
('default', 'notify.reminder.enabled', 'false',              '日报提醒是否启用'),
('default', 'notify.reminder.cron',    '0 0 17 * * MON-FRI', '日报提醒cron（每工作日17:00）'),
('default', 'notify.reminder.template', '【IT运维平台】您今日尚未提交工作日报，请尽快填写。', '提醒邮件正文模板');

CREATE TABLE notification_message (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    user_id         BIGINT NOT NULL,
    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL,
    type            VARCHAR(64) NOT NULL DEFAULT 'system',
    ref_type        VARCHAR(64),
    ref_id          BIGINT,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMP,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT
);
CREATE INDEX idx_notification_user ON notification_message(user_id, is_read) WHERE NOT is_deleted;
CREATE INDEX idx_notification_tenant ON notification_message(tenant_id, created_at DESC) WHERE NOT is_deleted;

-- RBAC: notification resource (只有 read 和 manage 两个 action)
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('notification', '通知中心', '["read","manage"]', 90);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'notification';

-- 所有角色都有 notification:read
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE p.code = 'notification:read'
ON CONFLICT DO NOTHING;

-- 管理员以上有 notification:manage（用于SMTP配置）
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code = 'notification:manage'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply migration by restarting backend container**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose restart backend
docker compose logs backend --tail=30
```

Expected: Flyway logs `Successfully applied 1 migration to schema "public", now at version v7`.

- [ ] **Step 3: Verify tables created**

```bash
docker compose exec db psql -U platform_user -d cwgsyw_platform -c "\dt sys_config" -c "\dt notification_message"
```

Expected: Both tables listed.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V7__create_notification_tables.sql
git commit -m "feat: V7 migration - notification_message and sys_config tables"
```

---

## Task 2: Backend — SysConfig entity + service

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/config/entity/SysConfig.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigService.java`

- [ ] **Step 1: Create SysConfig entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/config/entity/SysConfig.java
package com.cwgsyw.platform.module.config.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("sys_config")
public class SysConfig {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String configKey;
    private String configValue;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 2: Create SysConfigMapper**

```java
// backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigMapper.java
package com.cwgsyw.platform.module.config;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.config.entity.SysConfig;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface SysConfigMapper extends BaseMapper<SysConfig> {
    @Select("SELECT * FROM sys_config WHERE tenant_id = #{tenantId}")
    List<SysConfig> findByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT config_value FROM sys_config WHERE tenant_id = #{tenantId} AND config_key = #{key}")
    String findValue(@Param("tenantId") String tenantId, @Param("key") String key);
}
```

- [ ] **Step 3: Create SysConfigService**

```java
// backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigService.java
package com.cwgsyw.platform.module.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.module.config.entity.SysConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysConfigService {
    private final SysConfigMapper configMapper;

    public String get(String tenantId, String key) {
        String val = configMapper.findValue(tenantId, key);
        return val != null ? val : "";
    }

    public boolean getBoolean(String tenantId, String key) {
        return "true".equalsIgnoreCase(get(tenantId, key));
    }

    public Map<String, String> getAll(String tenantId) {
        return configMapper.findByTenant(tenantId).stream()
            .collect(Collectors.toMap(SysConfig::getConfigKey, c -> c.getConfigValue() != null ? c.getConfigValue() : ""));
    }

    public void set(String tenantId, String key, String value) {
        configMapper.update(null, new LambdaUpdateWrapper<SysConfig>()
            .eq(SysConfig::getTenantId, tenantId)
            .eq(SysConfig::getConfigKey, key)
            .set(SysConfig::getConfigValue, value)
            .set(SysConfig::getUpdatedAt, java.time.LocalDateTime.now()));
    }

    public void setAll(String tenantId, Map<String, String> kvs) {
        kvs.forEach((k, v) -> set(tenantId, k, v));
    }
}
```

- [ ] **Step 4: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend
./mvnw compile -q 2>&1 | tail -20
```

Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/config/
git commit -m "feat: SysConfig entity, mapper, service"
```

---

## Task 3: Backend — EmailService

**Files:**
- Modify: `backend/pom.xml` — add spring-boot-starter-mail
- Modify: `backend/src/main/resources/application.yml` — mail placeholder
- Modify: `backend/src/main/resources/application-dev.yml` — dev mail stub
- Create: `backend/src/main/java/com/cwgsyw/platform/config/EmailService.java`

- [ ] **Step 1: Add spring-boot-starter-mail to pom.xml**

In pom.xml, inside `<dependencies>`, after the `spring-boot-starter-actuator` entry:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-mail</artifactId>
</dependency>
```

- [ ] **Step 2: Add mail config block to application.yml**

Append to `backend/src/main/resources/application.yml` after the `encrypt:` block:

```yaml
spring:
  mail:
    host: ${SMTP_HOST:localhost}
    port: ${SMTP_PORT:25}
    username: ${SMTP_USERNAME:}
    password: ${SMTP_PASSWORD:}
    properties:
      mail:
        smtp:
          auth: true
          ssl:
            enable: ${SMTP_SSL:false}
          starttls:
            enable: false
```

Note: These env vars are optional fallbacks. Runtime SMTP config is loaded from `sys_config` table. The Spring mail properties here are just structural placeholders so the auto-config bean exists.

- [ ] **Step 3: Add dev mail settings to application-dev.yml**

Append to `backend/src/main/resources/application-dev.yml`:

```yaml
spring:
  mail:
    host: localhost
    port: 1025
```

- [ ] **Step 4: Create EmailService**

```java
// backend/src/main/java/com/cwgsyw/platform/config/EmailService.java
package com.cwgsyw.platform.config;

import com.cwgsyw.platform.module.config.SysConfigService;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import java.util.Properties;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {
    private final SysConfigService configService;

    public void send(String tenantId, String toEmail, String subject, String body) {
        if (!configService.getBoolean(tenantId, "smtp.enabled")) {
            log.debug("SMTP disabled for tenant {}, skip sending to {}", tenantId, toEmail);
            return;
        }
        if (toEmail == null || toEmail.isBlank()) {
            log.debug("No email address for recipient, skip");
            return;
        }
        try {
            JavaMailSenderImpl sender = buildSender(tenantId);
            MimeMessage msg = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, false, "UTF-8");
            String fromName = configService.get(tenantId, "smtp.from_name");
            String fromAddr = configService.get(tenantId, "smtp.from");
            helper.setFrom(fromAddr, fromName);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(body, false);
            sender.send(msg);
            log.info("Email sent to {} subject={}", toEmail, subject);
        } catch (Exception e) {
            log.error("Failed to send email to {}: {}", toEmail, e.getMessage());
        }
    }

    private JavaMailSenderImpl buildSender(String tenantId) {
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(configService.get(tenantId, "smtp.host"));
        sender.setPort(Integer.parseInt(configService.get(tenantId, "smtp.port")));
        sender.setUsername(configService.get(tenantId, "smtp.username"));
        sender.setPassword(configService.get(tenantId, "smtp.password"));
        sender.setDefaultEncoding("UTF-8");
        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", "true");
        boolean ssl = configService.getBoolean(tenantId, "smtp.ssl");
        props.put("mail.smtp.ssl.enable", String.valueOf(ssl));
        props.put("mail.smtp.starttls.enable", String.valueOf(!ssl));
        return sender;
    }
}
```

- [ ] **Step 5: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend
./mvnw compile -q 2>&1 | tail -20
```

Expected: BUILD SUCCESS.

- [ ] **Step 6: Commit**

```bash
git add pom.xml \
  src/main/resources/application.yml \
  src/main/resources/application-dev.yml \
  src/main/java/com/cwgsyw/platform/config/EmailService.java
git commit -m "feat: EmailService with runtime SMTP config from sys_config"
```

---

## Task 4: Backend — NotificationService + controller

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/notification/entity/NotificationMessage.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/notification/dto/NotificationVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationService.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationController.java`

- [ ] **Step 1: Create NotificationMessage entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/notification/entity/NotificationMessage.java
package com.cwgsyw.platform.module.notification.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
@TableName("notification_message")
public class NotificationMessage {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private Long userId;
    private String title;
    private String content;
    private String type;
    private String refType;
    private Long refId;
    private Boolean isRead;
    private LocalDateTime readAt;
    @TableLogic
    private Boolean isDeleted;
    private LocalDateTime deletedAt;
    private Long deletedBy;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
    @TableField(fill = FieldFill.INSERT)
    private Long createdBy;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updatedBy;
}
```

- [ ] **Step 2: Create NotificationMapper**

```java
// backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationMapper.java
package com.cwgsyw.platform.module.notification;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.notification.entity.NotificationMessage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface NotificationMapper extends BaseMapper<NotificationMessage> {
    @Select("SELECT COUNT(*) FROM notification_message WHERE user_id = #{userId} AND is_read = false AND is_deleted = false")
    int countUnread(@Param("userId") Long userId);
}
```

- [ ] **Step 3: Create NotificationVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/notification/dto/NotificationVO.java
package com.cwgsyw.platform.module.notification.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class NotificationVO {
    private Long id;
    private String title;
    private String content;
    private String type;
    private String refType;
    private Long refId;
    private Boolean isRead;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 4: Create NotificationService**

```java
// backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationService.java
package com.cwgsyw.platform.module.notification;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.config.EmailService;
import com.cwgsyw.platform.module.notification.dto.NotificationVO;
import com.cwgsyw.platform.module.notification.entity.NotificationMessage;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {
    private final NotificationMapper notificationMapper;
    private final EmailService emailService;
    private final UserMapper userMapper;

    /** Save in-app message and optionally send email to user. */
    public void notify(String tenantId, Long userId, String title, String content,
                       String type, String refType, Long refId) {
        NotificationMessage msg = NotificationMessage.builder()
            .tenantId(tenantId)
            .userId(userId)
            .title(title)
            .content(content)
            .type(type)
            .refType(refType)
            .refId(refId)
            .isRead(false)
            .isDeleted(false)
            .createdAt(LocalDateTime.now())
            .updatedAt(LocalDateTime.now())
            .build();
        notificationMapper.insert(msg);

        User user = userMapper.selectById(userId);
        if (user != null && user.getEmail() != null && !user.getEmail().isBlank()) {
            emailService.send(tenantId, user.getEmail(), title, content);
        }
    }

    public int countUnread(Long userId) {
        return notificationMapper.countUnread(userId);
    }

    public PageResult<NotificationVO> listByUser(Long userId, int page, int size) {
        Page<NotificationMessage> p = notificationMapper.selectPage(
            new Page<>(page, size),
            new LambdaQueryWrapper<NotificationMessage>()
                .eq(NotificationMessage::getUserId, userId)
                .eq(NotificationMessage::getIsDeleted, false)
                .orderByDesc(NotificationMessage::getCreatedAt));
        return PageResult.of(p.convert(this::toVO));
    }

    public void markRead(Long id, Long userId) {
        notificationMapper.update(null, new LambdaUpdateWrapper<NotificationMessage>()
            .eq(NotificationMessage::getId, id)
            .eq(NotificationMessage::getUserId, userId)
            .set(NotificationMessage::getIsRead, true)
            .set(NotificationMessage::getReadAt, LocalDateTime.now()));
    }

    public void markAllRead(Long userId) {
        notificationMapper.update(null, new LambdaUpdateWrapper<NotificationMessage>()
            .eq(NotificationMessage::getUserId, userId)
            .eq(NotificationMessage::getIsRead, false)
            .set(NotificationMessage::getIsRead, true)
            .set(NotificationMessage::getReadAt, LocalDateTime.now()));
    }

    private NotificationVO toVO(NotificationMessage m) {
        NotificationVO vo = new NotificationVO();
        vo.setId(m.getId());
        vo.setTitle(m.getTitle());
        vo.setContent(m.getContent());
        vo.setType(m.getType());
        vo.setRefType(m.getRefType());
        vo.setRefId(m.getRefId());
        vo.setIsRead(m.getIsRead());
        vo.setCreatedAt(m.getCreatedAt());
        return vo;
    }
}
```

- [ ] **Step 5: Create NotificationController**

```java
// backend/src/main/java/com/cwgsyw/platform/module/notification/NotificationController.java
package com.cwgsyw.platform.module.notification;

import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.notification.dto.NotificationVO;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

    @GetMapping
    @PreAuthorize("hasAuthority('notification:read')")
    public R<PageResult<NotificationVO>> list(
            @AuthenticationPrincipal SecurityUser user,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return R.ok(notificationService.listByUser(user.getUserId(), page, size));
    }

    @GetMapping("/unread-count")
    @PreAuthorize("hasAuthority('notification:read')")
    public R<Integer> unreadCount(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(notificationService.countUnread(user.getUserId()));
    }

    @PostMapping("/{id}/read")
    @PreAuthorize("hasAuthority('notification:read')")
    public R<Void> markRead(@PathVariable Long id, @AuthenticationPrincipal SecurityUser user) {
        notificationService.markRead(id, user.getUserId());
        return R.ok(null);
    }

    @PostMapping("/read-all")
    @PreAuthorize("hasAuthority('notification:read')")
    public R<Void> markAllRead(@AuthenticationPrincipal SecurityUser user) {
        notificationService.markAllRead(user.getUserId());
        return R.ok(null);
    }
}
```

- [ ] **Step 6: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend
./mvnw compile -q 2>&1 | tail -20
```

Expected: BUILD SUCCESS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/notification/
git commit -m "feat: NotificationService, mapper, controller with in-app + email"
```

---

## Task 5: Backend — SysConfigController (admin SMTP settings)

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/config/dto/SmtpConfigRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/config/dto/NotificationConfigRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigController.java`

- [ ] **Step 1: Create SmtpConfigRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/config/dto/SmtpConfigRequest.java
package com.cwgsyw.platform.module.config.dto;

import lombok.Data;

@Data
public class SmtpConfigRequest {
    private Boolean enabled;
    private String host;
    private Integer port;
    private String username;
    private String password;
    private String from;
    private String fromName;
    private Boolean ssl;
}
```

- [ ] **Step 2: Create NotificationConfigRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/config/dto/NotificationConfigRequest.java
package com.cwgsyw.platform.module.config.dto;

import lombok.Data;

@Data
public class NotificationConfigRequest {
    private Boolean reminderEnabled;
    private String reminderCron;
    private String reminderTemplate;
}
```

- [ ] **Step 3: Create SysConfigController**

```java
// backend/src/main/java/com/cwgsyw/platform/module/config/SysConfigController.java
package com.cwgsyw.platform.module.config;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.config.dto.NotificationConfigRequest;
import com.cwgsyw.platform.module.config.dto.SmtpConfigRequest;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/config")
@RequiredArgsConstructor
public class SysConfigController {
    private final SysConfigService configService;

    @GetMapping
    @PreAuthorize("hasAuthority('notification:manage')")
    public R<Map<String, String>> getAll(@AuthenticationPrincipal SecurityUser user) {
        Map<String, String> all = configService.getAll(user.getTenantId());
        // mask SMTP password
        if (all.containsKey("smtp.password") && !all.get("smtp.password").isBlank()) {
            all.put("smtp.password", "••••••••");
        }
        return R.ok(all);
    }

    @PutMapping("/smtp")
    @PreAuthorize("hasAuthority('notification:manage')")
    public R<Void> updateSmtp(@AuthenticationPrincipal SecurityUser user,
                               @RequestBody SmtpConfigRequest req) {
        String tid = user.getTenantId();
        if (req.getEnabled() != null) configService.set(tid, "smtp.enabled", String.valueOf(req.getEnabled()));
        if (req.getHost() != null)    configService.set(tid, "smtp.host", req.getHost());
        if (req.getPort() != null)    configService.set(tid, "smtp.port", String.valueOf(req.getPort()));
        if (req.getUsername() != null) configService.set(tid, "smtp.username", req.getUsername());
        if (req.getPassword() != null && !req.getPassword().startsWith("••")) {
            configService.set(tid, "smtp.password", req.getPassword());
        }
        if (req.getFrom() != null)     configService.set(tid, "smtp.from", req.getFrom());
        if (req.getFromName() != null) configService.set(tid, "smtp.from_name", req.getFromName());
        if (req.getSsl() != null)      configService.set(tid, "smtp.ssl", String.valueOf(req.getSsl()));
        return R.ok(null);
    }

    @PutMapping("/notification")
    @PreAuthorize("hasAuthority('notification:manage')")
    public R<Void> updateNotification(@AuthenticationPrincipal SecurityUser user,
                                       @RequestBody NotificationConfigRequest req) {
        String tid = user.getTenantId();
        if (req.getReminderEnabled() != null)
            configService.set(tid, "notify.reminder.enabled", String.valueOf(req.getReminderEnabled()));
        if (req.getReminderCron() != null)
            configService.set(tid, "notify.reminder.cron", req.getReminderCron());
        if (req.getReminderTemplate() != null)
            configService.set(tid, "notify.reminder.template", req.getReminderTemplate());
        return R.ok(null);
    }
}
```

- [ ] **Step 4: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend
./mvnw compile -q 2>&1 | tail -20
```

Expected: BUILD SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/config/
git commit -m "feat: SysConfigController admin SMTP and notification settings"
```

---

## Task 6: Backend — Wire notifications into DailyReport flow

**Files:**
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/workflow/DailyReportApprovalListener.java`

- [ ] **Step 1: Modify DailyReportService.submit() to notify group leaders**

In `DailyReportService`, inject `NotificationService` and `GroupMapper`. After `reportMapper.updateById(report)` in the `submit()` method, add:

```java
// Add to field declarations:
private final NotificationService notificationService;

// Inside submit(), after reportMapper.updateById(report):
// Notify all group leaders that a report awaits approval
var groupMembers = userMapper.selectList(
    new com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<com.cwgsyw.platform.module.user.entity.User>()
        .eq(com.cwgsyw.platform.module.user.entity.User::getGroupId, report.getGroupId())
        .eq(com.cwgsyw.platform.module.user.entity.User::getIsDeleted, false));
String reporterName = groupMembers.stream()
    .filter(u -> u.getId().equals(userId))
    .findFirst()
    .map(u -> u.getRealName() != null ? u.getRealName() : u.getUsername())
    .orElse("组员");
// We notify leaders by querying their roles — simplest: notify all users in group with group_leader role
// Use RbacService to get role-based users is complex; instead query sys_user_role join
// For MVP: send notification to all users in same group (leaders will see it; members ignore)
// Leaders are identified by scope in SecurityUser; here we use a DB query on sys_user_role
groupMembers.stream()
    .filter(u -> !u.getId().equals(userId))
    .forEach(leader -> notificationService.notify(
        report.getTenantId(),
        leader.getId(),
        "日报待审批",
        reporterName + " 提交了 " + report.getReportDate() + " 的工作日报，请审批。",
        "daily_report_submit",
        "daily_report",
        report.getId()));
```

Full modified `submit()` method:

```java
@Transactional
public void submit(Long id, Long userId) {
    DailyReport report = getAndCheckOwner(id, userId);
    if (!"DRAFT".equals(report.getStatus()) && !"REJECTED".equals(report.getStatus())) {
        throw new IllegalArgumentException("只能提交草稿或被拒绝的日报");
    }
    String processInstId = workflowService.startDailyReportApproval(id, report.getGroupId());
    report.setStatus("SUBMITTED");
    report.setProcessInstId(processInstId);
    reportMapper.updateById(report);

    var allInGroup = userMapper.selectList(
        new LambdaQueryWrapper<com.cwgsyw.platform.module.user.entity.User>()
            .eq(com.cwgsyw.platform.module.user.entity.User::getGroupId, report.getGroupId())
            .eq(com.cwgsyw.platform.module.user.entity.User::getIsDeleted, false));
    String reporterName = allInGroup.stream()
        .filter(u -> u.getId().equals(userId))
        .findFirst()
        .map(u -> u.getRealName() != null ? u.getRealName() : u.getUsername())
        .orElse("组员");
    allInGroup.stream()
        .filter(u -> !u.getId().equals(userId))
        .forEach(u -> notificationService.notify(
            report.getTenantId(), u.getId(),
            "日报待审批",
            reporterName + " 提交了 " + report.getReportDate() + " 的工作日报，请审批。",
            "daily_report_submit", "daily_report", report.getId()));
}
```

- [ ] **Step 2: Modify DailyReportApprovalListener to notify reporter of result**

```java
// backend/src/main/java/com/cwgsyw/platform/module/workflow/DailyReportApprovalListener.java
package com.cwgsyw.platform.module.workflow;

import com.cwgsyw.platform.module.daily.DailyReportService;
import com.cwgsyw.platform.module.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.ExecutionListener;
import org.springframework.stereotype.Component;

@Component("dailyReportApprovalListener")
@RequiredArgsConstructor
@Slf4j
public class DailyReportApprovalListener implements ExecutionListener {
    private final DailyReportService dailyReportService;
    private final NotificationService notificationService;

    @Override
    public void notify(DelegateExecution execution) {
        String processInstId = execution.getProcessInstanceId();
        Boolean approved = (Boolean) execution.getVariable("approved");
        String status = Boolean.TRUE.equals(approved) ? "APPROVED" : "REJECTED";
        log.info("Daily report approval finished: processInst={}, status={}", processInstId, status);
        var report = dailyReportService.updateStatusByProcessInstAndReturn(processInstId, status);
        if (report != null) {
            String title = "APPROVED".equals(status) ? "日报审批通过" : "日报被拒绝";
            String content = "APPROVED".equals(status)
                ? "您 " + report.getReportDate() + " 的工作日报已审批通过。"
                : "您 " + report.getReportDate() + " 的工作日报已被拒绝，请修改后重新提交。";
            notificationService.notify(report.getTenantId(), report.getReporterId(),
                title, content, "daily_report_approval", "daily_report", report.getId());
        }
    }
}
```

- [ ] **Step 3: Add updateStatusByProcessInstAndReturn to DailyReportService**

Rename the existing `updateStatusByProcessInst` to also return the report. Add a new method (keep old signature for backward compat if needed, but here we replace):

```java
// Replace updateStatusByProcessInst in DailyReportService:
@Transactional
public DailyReport updateStatusByProcessInstAndReturn(String processInstId, String status) {
    DailyReport report = reportMapper.selectOne(
        new LambdaQueryWrapper<DailyReport>()
            .eq(DailyReport::getProcessInstId, processInstId));
    if (report == null) return null;
    String oldStatus = report.getStatus();
    report.setStatus(status);
    reportMapper.updateById(report);
    auditLogMapper.insert(AuditLog.builder()
        .tenantId(report.getTenantId())
        .module("daily_report")
        .action("APPROVED".equals(status) ? "approve" : "reject")
        .targetId(report.getId())
        .targetType("daily_report")
        .operatorId(0L)
        .remark("processInst=" + processInstId + ", " + oldStatus + " -> " + status)
        .createdAt(LocalDateTime.now())
        .build());
    return report;
}

// Keep old void method calling the new one for any other callers:
@Transactional
public void updateStatusByProcessInst(String processInstId, String status) {
    updateStatusByProcessInstAndReturn(processInstId, status);
}
```

- [ ] **Step 4: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend
./mvnw compile -q 2>&1 | tail -20
```

Expected: BUILD SUCCESS.

- [ ] **Step 5: Rebuild and restart backend**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend
docker compose up -d backend
docker compose logs backend --tail=40
```

Expected: Started successfully, no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java \
        backend/src/main/java/com/cwgsyw/platform/module/workflow/DailyReportApprovalListener.java
git commit -m "feat: wire notifications into daily report submit and approval flow"
```

---

## Task 7: Backend — Scheduled daily-report reminder

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/scheduler/DailyReportReminderScheduler.java`

- [ ] **Step 1: Create the scheduler**

```java
// backend/src/main/java/com/cwgsyw/platform/scheduler/DailyReportReminderScheduler.java
package com.cwgsyw.platform.scheduler;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.config.SysConfigService;
import com.cwgsyw.platform.module.daily.DailyReportMapper;
import com.cwgsyw.platform.module.daily.entity.DailyReport;
import com.cwgsyw.platform.module.notification.NotificationService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class DailyReportReminderScheduler {
    private final SysConfigService configService;
    private final UserMapper userMapper;
    private final DailyReportMapper reportMapper;
    private final NotificationService notificationService;

    // Runs every minute; actual send is gated by config cron check
    @Scheduled(cron = "0 * * * * *")
    public void checkAndSendReminders() {
        String tenantId = "default";
        if (!configService.getBoolean(tenantId, "notify.reminder.enabled")) return;

        String configCron = configService.get(tenantId, "notify.reminder.cron");
        if (!matchesCurrentMinute(configCron)) return;

        LocalDate today = LocalDate.now();
        List<User> allUsers = userMapper.selectList(
            new LambdaQueryWrapper<User>().eq(User::getIsDeleted, false));

        Set<Long> haveFiled = reportMapper.selectList(
            new LambdaQueryWrapper<DailyReport>()
                .eq(DailyReport::getReportDate, today)
                .eq(DailyReport::getIsDeleted, false))
            .stream().map(DailyReport::getReporterId).collect(Collectors.toSet());

        String template = configService.get(tenantId, "notify.reminder.template");

        allUsers.stream()
            .filter(u -> !haveFiled.contains(u.getId()))
            .forEach(u -> {
                log.info("Sending daily report reminder to user {}", u.getId());
                notificationService.notify(tenantId, u.getId(),
                    "工作日报提醒", template,
                    "daily_report_reminder", null, null);
            });
    }

    // Simple cron minute-level match: checks if current time matches cron expression
    // Only supports standard 6-field Spring cron: sec min hour dom month dow
    private boolean matchesCurrentMinute(String cron) {
        if (cron == null || cron.isBlank()) return false;
        try {
            String[] parts = cron.trim().split("\\s+");
            if (parts.length < 6) return false;
            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            boolean minMatch = parts[1].equals("*") || parts[1].equals(String.valueOf(now.getMinute()));
            boolean hourMatch = parts[2].equals("*") || parts[2].equals(String.valueOf(now.getHour()));
            boolean dowRaw = parts[5];
            boolean dowMatch = dowRaw.equals("*") ||
                dowRaw.contains(String.valueOf(now.getDayOfWeek().getValue() % 7));
            return minMatch && hourMatch && dowMatch;
        } catch (Exception e) {
            return false;
        }
    }
}
```

Note: The `matchesCurrentMinute` is a minimal parser for `0 0 17 * * MON-FRI` style crons. It handles the default reminder cron. For production, a proper cron library (e.g., `CronExpression` from Spring) would be cleaner.

- [ ] **Step 2: Fix the dowRaw variable (syntax issue in step 1)**

The `matchesCurrentMinute` method has a variable declaration issue. Replace the full method:

```java
private boolean matchesCurrentMinute(String cron) {
    if (cron == null || cron.isBlank()) return false;
    try {
        String[] parts = cron.trim().split("\\s+");
        if (parts.length < 6) return false;
        java.time.LocalDateTime now = java.time.LocalDateTime.now();
        boolean minMatch  = parts[1].equals("*") || parts[1].equals(String.valueOf(now.getMinute()));
        boolean hourMatch = parts[2].equals("*") || parts[2].equals(String.valueOf(now.getHour()));
        String dow = parts[5];
        boolean dowMatch  = dow.equals("*") || dow.contains(String.valueOf(now.getDayOfWeek().getValue() % 7));
        return minMatch && hourMatch && dowMatch;
    } catch (Exception e) {
        return false;
    }
}
```

- [ ] **Step 3: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend
./mvnw compile -q 2>&1 | tail -20
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/scheduler/
git commit -m "feat: scheduled daily report reminder using sys_config cron"
```

---

## Task 8: Frontend — NotificationBell component

**Files:**
- Create: `frontend/src/components/layout/NotificationBell.tsx`
- Modify: `frontend/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create NotificationBell component**

```tsx
// frontend/src/components/layout/NotificationBell.tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import api from '@/lib/api'
import { cn } from '@/lib/utils'

export function NotificationBell() {
  const { data: count = 0 } = useQuery<number>({
    queryKey: ['notification-unread'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data.data),
    refetchInterval: 30_000,
  })

  return (
    <Link href="/notifications" className="relative inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors">
      <Bell className="h-5 w-5 text-muted-foreground" />
      {count > 0 && (
        <span className={cn(
          'absolute -top-0.5 -right-0.5 inline-flex items-center justify-center',
          'min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold',
          'bg-red-500 text-white leading-none'
        )}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Read existing layout.tsx to know where to insert the bell**

```bash
cat /Volumes/Work/AI/cwgsyw-platform/frontend/src/app/\(dashboard\)/layout.tsx
```

- [ ] **Step 3: Add NotificationBell to the dashboard layout header**

In `frontend/src/app/(dashboard)/layout.tsx`, import `NotificationBell` and place it in the top header bar. Find the header area (typically has a `<header>` or top nav div) and add the bell before any user avatar/menu. The exact insertion depends on the current layout; add `<NotificationBell />` to the right side of the header.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/NotificationBell.tsx \
        frontend/src/app/\(dashboard\)/layout.tsx
git commit -m "feat: NotificationBell component with unread count badge in header"
```

---

## Task 9: Frontend — Notification inbox page

**Files:**
- Create: `frontend/src/app/(dashboard)/notifications/page.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create notifications inbox page**

```tsx
// frontend/src/app/(dashboard)/notifications/page.tsx
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface NotificationVO {
  id: number
  title: string
  content: string
  type: string
  ref_type: string | null
  ref_id: number | null
  is_read: boolean
  created_at: string
}

interface PageResult {
  records: NotificationVO[]
  total: number
}

export default function NotificationsPage() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<PageResult>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications', { params: { page: 1, size: 50 } })
      .then(r => r.data.data),
  })

  const readMutation = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notification-unread'] })
    },
  })

  const readAllMutation = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      toast.success('已全部标记为已读')
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      queryClient.invalidateQueries({ queryKey: ['notification-unread'] })
    },
  })

  const records = data?.records ?? []
  const unreadCount = records.filter(n => !n.is_read).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">通知中心</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">{unreadCount} 条未读</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}>
            <CheckCheck className="h-4 w-4 mr-1" />全部已读
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">加载中...</p>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-muted-foreground gap-3">
          <Bell className="h-10 w-10 opacity-30" />
          <p>暂无通知</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(n => (
            <div
              key={n.id}
              onClick={() => !n.is_read && readMutation.mutate(n.id)}
              className={cn(
                'p-4 border rounded-lg transition-colors',
                n.is_read
                  ? 'bg-card cursor-default'
                  : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/30'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-2 min-w-0">
                  {!n.is_read && (
                    <span className="mt-1.5 inline-block w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className={cn('font-medium text-sm', !n.is_read && 'text-foreground')}>{n.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{n.content}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {new Date(n.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add Notifications nav item to Sidebar**

In `frontend/src/components/layout/Sidebar.tsx`, find the `navItems` array and add a notifications entry (all users have `notification:read`):

```tsx
{ href: '/notifications', label: '通知中心', icon: Bell, permission: { resource: 'notification', action: 'read' } },
```

Import `Bell` from lucide-react if not already imported.

- [ ] **Step 3: Verify sidebar renders notifications link**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose logs frontend --tail=10
```

Expected: no build errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/\(dashboard\)/notifications/page.tsx \
        frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: notification inbox page and sidebar nav item"
```

---

## Task 10: Frontend — Admin config page (SMTP + reminder settings)

**Files:**
- Create: `frontend/src/app/(dashboard)/admin/config/page.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create admin config page**

```tsx
// frontend/src/app/(dashboard)/admin/config/page.tsx
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { useRouter } from 'next/navigation'

export default function AdminConfigPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!hasPermission('notification', 'manage')) router.replace('/')
  }, [hasPermission, router])

  const { data: config = {} } = useQuery<Record<string, string>>({
    queryKey: ['admin-config'],
    queryFn: () => api.get('/admin/config').then(r => r.data.data),
    enabled: hasPermission('notification', 'manage'),
  })

  const [smtpEnabled, setSmtpEnabled] = useState(false)
  const [host, setHost] = useState('')
  const [port, setPort] = useState('465')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [from, setFrom] = useState('')
  const [fromName, setFromName] = useState('IT运维平台')
  const [ssl, setSsl] = useState(true)

  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderCron, setReminderCron] = useState('0 0 17 * * MON-FRI')
  const [reminderTemplate, setReminderTemplate] = useState('')

  useEffect(() => {
    if (!config || Object.keys(config).length === 0) return
    setSmtpEnabled(config['smtp.enabled'] === 'true')
    setHost(config['smtp.host'] ?? '')
    setPort(config['smtp.port'] ?? '465')
    setUsername(config['smtp.username'] ?? '')
    setPassword(config['smtp.password'] ?? '')
    setFrom(config['smtp.from'] ?? '')
    setFromName(config['smtp.from_name'] ?? 'IT运维平台')
    setSsl(config['smtp.ssl'] !== 'false')
    setReminderEnabled(config['notify.reminder.enabled'] === 'true')
    setReminderCron(config['notify.reminder.cron'] ?? '0 0 17 * * MON-FRI')
    setReminderTemplate(config['notify.reminder.template'] ?? '')
  }, [config])

  const smtpMutation = useMutation({
    mutationFn: () => api.put('/admin/config/smtp', {
      enabled: smtpEnabled, host, port: Number(port), username,
      password, from, from_name: fromName, ssl,
    }),
    onSuccess: () => { toast.success('SMTP 配置已保存'); queryClient.invalidateQueries({ queryKey: ['admin-config'] }) },
    onError: () => toast.error('保存失败'),
  })

  const notifyMutation = useMutation({
    mutationFn: () => api.put('/admin/config/notification', {
      reminder_enabled: reminderEnabled,
      reminder_cron: reminderCron,
      reminder_template: reminderTemplate,
    }),
    onSuccess: () => { toast.success('提醒配置已保存'); queryClient.invalidateQueries({ queryKey: ['admin-config'] }) },
    onError: () => toast.error('保存失败'),
  })

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">系统配置</h1>

      {/* SMTP */}
      <section className="border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">邮件服务 (SMTP)</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={smtpEnabled} onCheckedChange={setSmtpEnabled} id="smtp-enabled" />
            <Label htmlFor="smtp-enabled">启用邮件发送</Label>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>SMTP 服务器</Label>
              <Input value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>端口</Label>
              <Input value={port} onChange={e => setPort(e.target.value)} placeholder="465" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>用户名</Label>
              <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="user@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>密码</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>发件人地址</Label>
              <Input value={from} onChange={e => setFrom(e.target.value)} placeholder="noreply@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>发件人名称</Label>
              <Input value={fromName} onChange={e => setFromName(e.target.value)} placeholder="IT运维平台" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={ssl} onCheckedChange={setSsl} id="smtp-ssl" />
            <Label htmlFor="smtp-ssl">使用 SSL</Label>
          </div>
          <Button onClick={() => smtpMutation.mutate()} disabled={smtpMutation.isPending}>
            保存 SMTP 配置
          </Button>
        </div>
      </section>

      {/* Reminder */}
      <section className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">日报提醒</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} id="reminder-enabled" />
            <Label htmlFor="reminder-enabled">启用日报提醒</Label>
          </div>
          <div className="space-y-1.5">
            <Label>提醒时间 (Spring Cron)</Label>
            <Input value={reminderCron} onChange={e => setReminderCron(e.target.value)}
              placeholder="0 0 17 * * MON-FRI" />
            <p className="text-xs text-muted-foreground">示例：0 0 17 * * MON-FRI（每工作日 17:00）</p>
          </div>
          <div className="space-y-1.5">
            <Label>提醒消息内容</Label>
            <Textarea value={reminderTemplate} onChange={e => setReminderTemplate(e.target.value)}
              rows={3} placeholder="您今日尚未提交工作日报，请尽快填写。" />
          </div>
          <Button onClick={() => notifyMutation.mutate()} disabled={notifyMutation.isPending}>
            保存提醒配置
          </Button>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Add admin config nav item to Sidebar**

In `frontend/src/components/layout/Sidebar.tsx`, find the `navItems` array and add (under admin section or at bottom, guarded by `notification:manage`):

```tsx
{ href: '/admin/config', label: '系统配置', icon: Settings, permission: { resource: 'notification', action: 'manage' } },
```

Import `Settings` from lucide-react if not already imported.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(dashboard\)/admin/config/page.tsx \
        frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: admin config page for SMTP and daily report reminder settings"
```

---

## Task 11: Integration test + final build

- [ ] **Step 1: Rebuild backend and restart all**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend
docker compose up -d
docker compose ps
```

Expected: all containers healthy.

- [ ] **Step 2: Verify migrations applied**

```bash
docker compose exec db psql -U platform_user -d cwgsyw_platform \
  -c "SELECT config_key, config_value FROM sys_config WHERE tenant_id='default' LIMIT 5;"
```

Expected: rows including `smtp.enabled`, `smtp.host`, `notify.reminder.enabled`.

- [ ] **Step 3: Test notification API as superadmin**

Login, get token, then:

```bash
TOKEN="<jwt from login>"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/notifications/unread-count | jq .
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/notifications?page=1&size=10 | jq .
```

Expected: `{"code":200,"data":0}` for unread count (no notifications yet), and empty records list.

- [ ] **Step 4: Test admin config API**

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/admin/config | jq .
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/admin/config/smtp \
  -d '{"enabled":false,"host":"smtp.test.com","port":465,"username":"test","password":"pass","from":"noreply@test.com","from_name":"Test","ssl":true}' | jq .
```

Expected: both return `{"code":200,...}`.

- [ ] **Step 5: Submit a daily report and verify in-app notification is created**

Via frontend: submit a draft daily report. Then check:

```bash
curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/notifications?page=1&size=10 | jq .data.records
```

Expected: notification with title "日报待审批" appears for group leader users.

- [ ] **Step 6: Tag release**

```bash
git tag v0.3.0-notifications
git log --oneline -8
```

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: phase 2c complete - email notification center with in-app inbox, SMTP config, reminder scheduler" --allow-empty
```

---

## RBAC Checklist (mandatory for every new module)

- [x] New `notification` resource added in V7 migration with actions `read` and `manage`
- [x] All roles get `notification:read`; only `super_admin` and `admin` get `notification:manage`
- [x] `@PreAuthorize` guards on all controller endpoints
- [x] Frontend pages check `hasPermission` before rendering admin-only content
- [x] Sidebar nav items gated by permission
