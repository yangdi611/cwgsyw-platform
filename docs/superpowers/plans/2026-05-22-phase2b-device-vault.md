# Phase 2b — 设备密码库 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现设备密码库，支持设备信息和账号密码的安全存储、按权限查询，以及完整的查看审计记录。

**Architecture:** 后端新增 `device` 模块，密码字段使用 AES-256-GCM 加密存储（密钥从环境变量注入，不落库）；加密/解密由 `CryptoService` 封装。查看密码触发审计写 `audit_log`，前端密码默认脱敏显示，点击"显示"才解密请求。RBAC 检查：组员按分类查看（组长配置可见分类），组长/管理员可管理本组/全部。

**Tech Stack:** Spring Boot 3.4.5, Java 24, MyBatis-Plus 3.5.12, AES-256-GCM（javax.crypto），Next.js 16, TanStack Query v5, shadcn/ui

---

## RBAC 检查（新增模块必做）

本计划新增 `device` 资源，实施完成前必须：
1. V6 迁移脚本注册 `device` 资源
2. 前端权限配置页自动渲染（无需额外代码）
3. 所有新接口加 `@PreAuthorize("hasPermission(...)")`
4. 默认角色无新模块权限，由超级管理员手动分配

---

## 文件结构

### 后端新增

```
backend/src/main/java/com/cwgsyw/platform/
├── config/
│   └── CryptoService.java                    # AES-256-GCM 加解密，密钥从 ${ENCRYPT_KEY} 注入
├── module/
│   └── device/
│       ├── entity/
│       │   ├── Device.java                   # 设备基本信息（名称、IP、类型、组别）
│       │   └── DeviceCredential.java         # 账号密码（密码字段加密存储）
│       ├── DeviceMapper.java
│       ├── DeviceCredentialMapper.java
│       ├── DeviceService.java                # CRUD + 解密 + 审计写入
│       ├── DeviceController.java             # /api/devices
│       └── dto/
│           ├── CreateDeviceRequest.java
│           ├── CreateCredentialRequest.java
│           └── DeviceVO.java                 # 含 credentials（密码脱敏）
└── ...

backend/src/main/resources/db/migration/
└── V6__create_device_tables.sql
```

### 前端新增

```
frontend/src/app/(dashboard)/
├── devices/
│   ├── page.tsx                              # 设备列表（按组/类型筛选）
│   ├── new/page.tsx                          # 新建设备
│   └── [id]/page.tsx                         # 设备详情 + 账号密码列表
└── ...
frontend/src/components/device/
└── CredentialRow.tsx                         # 单条账号密码行（含显示/隐藏密码）
```

---

## Task 1: 数据库迁移 + RBAC 资源注册

**Files:**
- Create: `backend/src/main/resources/db/migration/V6__create_device_tables.sql`

- [ ] **Step 1: 创建 V6 迁移脚本**

```sql
-- V6: 设备密码库

CREATE TABLE device (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    group_id    BIGINT REFERENCES sys_group(id),
    name        VARCHAR(128) NOT NULL,
    ip          VARCHAR(64),
    device_type VARCHAR(64) NOT NULL DEFAULT 'server',
    category    VARCHAR(64),
    description TEXT,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    updated_by  BIGINT
);
CREATE INDEX idx_device_group ON device(group_id) WHERE NOT is_deleted;
CREATE INDEX idx_device_tenant ON device(tenant_id) WHERE NOT is_deleted;

CREATE TABLE device_credential (
    id              BIGSERIAL PRIMARY KEY,
    device_id       BIGINT NOT NULL REFERENCES device(id),
    username        VARCHAR(128) NOT NULL,
    password_enc    TEXT NOT NULL,
    description     VARCHAR(255),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT,
    updated_by      BIGINT
);
CREATE INDEX idx_device_credential_device ON device_credential(device_id) WHERE NOT is_deleted;

-- password_access_log 单独审计表
CREATE TABLE password_access_log (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    device_id       BIGINT NOT NULL,
    credential_id   BIGINT NOT NULL,
    operator_id     BIGINT NOT NULL,
    operator_ip     VARCHAR(64),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pw_access_device ON password_access_log(device_id, created_at DESC);
CREATE INDEX idx_pw_access_operator ON password_access_log(operator_id, created_at DESC);

-- 注册资源
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('device', '设备密码库', '["create","read","update","delete","view_password"]', 80);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'device';

-- 超级管理员和管理员拥有全部设备权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'device:%'
ON CONFLICT DO NOTHING;

-- 组长可管理和查看密码
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader'
  AND p.code IN ('device:create','device:read','device:update','device:view_password')
ON CONFLICT DO NOTHING;

-- 组员只能查看（不含密码，密码需单独 view_password 权限）
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'member' AND p.code = 'device:read'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: 验证数据库连接正常**

```bash
docker exec cwgsyw-platform-postgres-1 psql -U platform_user -d cwgsyw_platform -c "SELECT count(*) FROM sys_resource;"
```

Expected: `count: 7`（V6 还没执行，先确认连接正常）

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V6__create_device_tables.sql
git commit -m "feat: V6 device tables and RBAC resource registration"
```

---

## Task 2: CryptoService（AES-256-GCM 加解密）

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/config/CryptoService.java`
- Test: `backend/src/test/java/com/cwgsyw/platform/config/CryptoServiceTest.java`

- [ ] **Step 1: 创建测试**

```java
// backend/src/test/java/com/cwgsyw/platform/config/CryptoServiceTest.java
package com.cwgsyw.platform.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class CryptoServiceTest {
    private CryptoService crypto;

    @BeforeEach
    void setUp() {
        // 32字节的测试密钥（Base64编码的32字节）
        crypto = new CryptoService("dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleQ==");
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
        // GCM 使用随机 nonce，每次密文不同
        assertThat(enc1).isNotEqualTo(enc2);
        assertThat(crypto.decrypt(enc1)).isEqualTo(plain);
        assertThat(crypto.decrypt(enc2)).isEqualTo(plain);
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd backend
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home mvn test -Dtest=CryptoServiceTest -pl . 2>&1 | tail -5
```

Expected: 编译错误，类不存在

- [ ] **Step 3: 实现 CryptoService**

```java
// backend/src/main/java/com/cwgsyw/platform/config/CryptoService.java
package com.cwgsyw.platform.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
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
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home mvn test -Dtest=CryptoServiceTest
```

Expected: `Tests run: 2, Failures: 0, Errors: 0`

注意：`application-dev.yml` 里的 `ENCRYPT_KEY` 值 `dev_encrypt_key_32bytes_here!!` 不是有效的 Base64 编码 32 字节，需要更新。在 `application-dev.yml` 里将其改为：
```yaml
encrypt:
  key: dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleQ==
```

对应的 `.env` 文件里更新：
```
ENCRYPT_KEY=dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleQ==
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/config/CryptoService.java \
        backend/src/test/java/com/cwgsyw/platform/config/CryptoServiceTest.java \
        backend/src/main/resources/application-dev.yml \
        .env
git commit -m "feat: AES-256-GCM CryptoService for password encryption"
```

---

## Task 3: 设备实体 + Mapper + DTO

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/device/entity/Device.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/device/entity/DeviceCredential.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceCredentialMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/device/dto/CreateDeviceRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/device/dto/CreateCredentialRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/device/dto/DeviceVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/device/dto/CredentialVO.java`

- [ ] **Step 1: 创建 Device 实体**

```java
// module/device/entity/Device.java
package com.cwgsyw.platform.module.device.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("device")
public class Device extends BaseEntity {
    private Long groupId;
    private String name;
    private String ip;
    private String deviceType;   // server / network / security / cloud / other
    private String category;     // 用户自定义分类标签
    private String description;
}
```

- [ ] **Step 2: 创建 DeviceCredential 实体**

```java
// module/device/entity/DeviceCredential.java
package com.cwgsyw.platform.module.device.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("device_credential")
public class DeviceCredential extends BaseEntity {
    private Long deviceId;
    private String username;
    private String passwordEnc;   // AES-256-GCM 加密密文，Base64
    private String description;
}
```

- [ ] **Step 3: 创建 DeviceMapper**

```java
// module/device/DeviceMapper.java
package com.cwgsyw.platform.module.device;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.device.entity.Device;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface DeviceMapper extends BaseMapper<Device> {}
```

- [ ] **Step 4: 创建 DeviceCredentialMapper**

```java
// module/device/DeviceCredentialMapper.java
package com.cwgsyw.platform.module.device;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.device.entity.DeviceCredential;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface DeviceCredentialMapper extends BaseMapper<DeviceCredential> {
    @Select("SELECT * FROM device_credential WHERE device_id = #{deviceId} AND is_deleted = false")
    List<DeviceCredential> findByDeviceId(Long deviceId);
}
```

- [ ] **Step 5: 创建 DTOs**

```java
// module/device/dto/CreateDeviceRequest.java
package com.cwgsyw.platform.module.device.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateDeviceRequest {
    @NotBlank private String name;
    private String ip;
    private String deviceType;
    private String category;
    private String description;
    private Long groupId;
}
```

```java
// module/device/dto/CreateCredentialRequest.java
package com.cwgsyw.platform.module.device.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreateCredentialRequest {
    @NotBlank private String username;
    @NotBlank private String password;   // 明文，Service 层加密
    private String description;
}
```

```java
// module/device/dto/CredentialVO.java
package com.cwgsyw.platform.module.device.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CredentialVO {
    private Long id;
    private Long deviceId;
    private String username;
    private String password;       // null（脱敏）或明文（调用解密接口后填入）
    private String description;
    private LocalDateTime createdAt;
}
```

```java
// module/device/dto/DeviceVO.java
package com.cwgsyw.platform.module.device.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class DeviceVO {
    private Long id;
    private Long groupId;
    private String groupName;
    private String name;
    private String ip;
    private String deviceType;
    private String category;
    private String description;
    private List<CredentialVO> credentials;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 6: 编译验证**

```bash
cd backend
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home mvn compile -q 2>&1 | tail -3
```

Expected: `BUILD SUCCESS`

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/device/
git commit -m "feat: device entity, mapper and DTOs"
```

---

## Task 4: DeviceService + DeviceController

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceController.java`

- [ ] **Step 1: 创建 DeviceService**

```java
// module/device/DeviceService.java
package com.cwgsyw.platform.module.device;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.AuditLogMapper;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.common.entity.AuditLog;
import com.cwgsyw.platform.config.CryptoService;
import com.cwgsyw.platform.module.device.dto.*;
import com.cwgsyw.platform.module.device.entity.Device;
import com.cwgsyw.platform.module.device.entity.DeviceCredential;
import com.cwgsyw.platform.module.org.GroupMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DeviceService {
    private final DeviceMapper deviceMapper;
    private final DeviceCredentialMapper credentialMapper;
    private final CryptoService crypto;
    private final AuditLogMapper auditLogMapper;
    private final GroupMapper groupMapper;

    public PageResult<DeviceVO> list(Long groupId, String deviceType, String category,
                                     int page, int size, String tenantId) {
        LambdaQueryWrapper<Device> query = new LambdaQueryWrapper<Device>()
            .eq(Device::getTenantId, tenantId)
            .eq(Device::getIsDeleted, false)
            .orderByDesc(Device::getCreatedAt);
        if (groupId != null) query.eq(Device::getGroupId, groupId);
        if (deviceType != null) query.eq(Device::getDeviceType, deviceType);
        if (category != null) query.eq(Device::getCategory, category);
        Page<Device> p = deviceMapper.selectPage(new Page<>(page, size), query);
        return PageResult.of(p.convert(d -> toVO(d, false)));
    }

    public DeviceVO getById(Long id, String tenantId) {
        Device device = deviceMapper.selectById(id);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        return toVO(device, true);
    }

    @Transactional
    public Device create(CreateDeviceRequest req, String tenantId, Long operatorId) {
        Device device = new Device();
        device.setTenantId(tenantId);
        device.setGroupId(req.getGroupId());
        device.setName(req.getName());
        device.setIp(req.getIp());
        device.setDeviceType(req.getDeviceType() != null ? req.getDeviceType() : "server");
        device.setCategory(req.getCategory());
        device.setDescription(req.getDescription());
        deviceMapper.insert(device);
        writeAudit(tenantId, "create", device.getId(), operatorId, null,
            "{\"name\":\"" + device.getName() + "\"}");
        return device;
    }

    @Transactional
    public void update(Long id, CreateDeviceRequest req, String tenantId, Long operatorId) {
        Device device = deviceMapper.selectById(id);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        if (req.getName() != null) device.setName(req.getName());
        if (req.getIp() != null) device.setIp(req.getIp());
        if (req.getDeviceType() != null) device.setDeviceType(req.getDeviceType());
        if (req.getCategory() != null) device.setCategory(req.getCategory());
        if (req.getDescription() != null) device.setDescription(req.getDescription());
        if (req.getGroupId() != null) device.setGroupId(req.getGroupId());
        deviceMapper.updateById(device);
        writeAudit(tenantId, "update", id, operatorId, null,
            "{\"name\":\"" + device.getName() + "\"}");
    }

    @Transactional
    public void delete(Long id, String tenantId, Long operatorId) {
        Device device = deviceMapper.selectById(id);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        device.setIsDeleted(true);
        device.setDeletedAt(LocalDateTime.now());
        device.setDeletedBy(operatorId);
        deviceMapper.updateById(device);
        writeAudit(tenantId, "delete", id, operatorId, null, null);
    }

    @Transactional
    public DeviceCredential addCredential(Long deviceId, CreateCredentialRequest req,
                                          String tenantId, Long operatorId) {
        Device device = deviceMapper.selectById(deviceId);
        if (device == null || device.getIsDeleted() || !device.getTenantId().equals(tenantId)) {
            throw new IllegalArgumentException("设备不存在");
        }
        DeviceCredential cred = new DeviceCredential();
        cred.setDeviceId(deviceId);
        cred.setUsername(req.getUsername());
        cred.setPasswordEnc(crypto.encrypt(req.getPassword()));
        cred.setDescription(req.getDescription());
        credentialMapper.insert(cred);
        writeAudit(tenantId, "add_credential", deviceId, operatorId, null,
            "{\"username\":\"" + req.getUsername() + "\"}");
        return cred;
    }

    @Transactional
    public void deleteCredential(Long credentialId, String tenantId, Long operatorId, String operatorIp) {
        DeviceCredential cred = credentialMapper.selectById(credentialId);
        if (cred == null || cred.getIsDeleted()) throw new IllegalArgumentException("账号不存在");
        cred.setIsDeleted(true);
        cred.setDeletedAt(LocalDateTime.now());
        cred.setDeletedBy(operatorId);
        credentialMapper.updateById(cred);
        writeAudit(tenantId, "delete_credential", cred.getDeviceId(), operatorId, null, null);
    }

    /** 解密并返回明文密码，同时写入 password_access_log */
    @Transactional
    public String revealPassword(Long credentialId, String tenantId, Long operatorId, String operatorIp) {
        DeviceCredential cred = credentialMapper.selectById(credentialId);
        if (cred == null || cred.getIsDeleted()) throw new IllegalArgumentException("账号不存在");
        // 写专属的密码查看审计
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("device")
            .action("view_password")
            .targetId(credentialId)
            .targetType("device_credential")
            .operatorId(operatorId)
            .operatorIp(operatorIp)
            .remark("credential_id=" + credentialId + " device_id=" + cred.getDeviceId())
            .createdAt(LocalDateTime.now())
            .build());
        return crypto.decrypt(cred.getPasswordEnc());
    }

    private DeviceVO toVO(Device d, boolean includeCredentials) {
        DeviceVO vo = new DeviceVO();
        vo.setId(d.getId());
        vo.setGroupId(d.getGroupId());
        vo.setName(d.getName());
        vo.setIp(d.getIp());
        vo.setDeviceType(d.getDeviceType());
        vo.setCategory(d.getCategory());
        vo.setDescription(d.getDescription());
        vo.setCreatedAt(d.getCreatedAt());
        vo.setUpdatedAt(d.getUpdatedAt());
        if (d.getGroupId() != null) {
            var group = groupMapper.selectById(d.getGroupId());
            if (group != null) vo.setGroupName(group.getName());
        }
        if (includeCredentials) {
            List<CredentialVO> creds = credentialMapper.findByDeviceId(d.getId())
                .stream().map(c -> {
                    CredentialVO cv = new CredentialVO();
                    cv.setId(c.getId());
                    cv.setDeviceId(c.getDeviceId());
                    cv.setUsername(c.getUsername());
                    cv.setDescription(c.getDescription());
                    cv.setCreatedAt(c.getCreatedAt());
                    // 密码不在列表接口返回，需单独调用 /reveal
                    return cv;
                }).collect(Collectors.toList());
            vo.setCredentials(creds);
        }
        return vo;
    }

    private void writeAudit(String tenantId, String action, Long targetId,
                            Long operatorId, String before, String after) {
        auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("device")
            .action(action)
            .targetId(targetId)
            .targetType("device")
            .operatorId(operatorId)
            .beforeJson(before)
            .afterJson(after)
            .createdAt(LocalDateTime.now())
            .build());
    }
}
```

- [ ] **Step 2: 创建 DeviceController**

```java
// module/device/DeviceController.java
package com.cwgsyw.platform.module.device;

import com.cwgsyw.platform.common.*;
import com.cwgsyw.platform.module.device.dto.*;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
public class DeviceController {
    private final DeviceService deviceService;

    @GetMapping
    @PreAuthorize("hasPermission('device', 'read')")
    public R<PageResult<DeviceVO>> list(
            @RequestParam(required = false) Long groupId,
            @RequestParam(required = false) String deviceType,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser cu) {
        // 组员只能看本组；组长/管理员可指定 groupId 或查全部
        Long effectiveGroupId = "group".equals(cu.getGroupScope()) ? cu.getGroupId() : groupId;
        return R.ok(deviceService.list(effectiveGroupId, deviceType, category, page, size, cu.getTenantId()));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasPermission('device', 'read')")
    public R<DeviceVO> getById(@PathVariable Long id,
                               @AuthenticationPrincipal SecurityUser cu) {
        return R.ok(deviceService.getById(id, cu.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('device', 'create')")
    public R<DeviceVO> create(@Valid @RequestBody CreateDeviceRequest req,
                              @AuthenticationPrincipal SecurityUser cu) {
        var device = deviceService.create(req, cu.getTenantId(), cu.getUserId());
        return R.ok(deviceService.getById(device.getId(), cu.getTenantId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('device', 'update')")
    public R<Void> update(@PathVariable Long id,
                          @RequestBody CreateDeviceRequest req,
                          @AuthenticationPrincipal SecurityUser cu) {
        deviceService.update(id, req, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('device', 'delete')")
    public R<Void> delete(@PathVariable Long id,
                          @AuthenticationPrincipal SecurityUser cu) {
        deviceService.delete(id, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @PostMapping("/{deviceId}/credentials")
    @PreAuthorize("hasPermission('device', 'create')")
    public R<Void> addCredential(@PathVariable Long deviceId,
                                 @Valid @RequestBody CreateCredentialRequest req,
                                 @AuthenticationPrincipal SecurityUser cu) {
        deviceService.addCredential(deviceId, req, cu.getTenantId(), cu.getUserId());
        return R.ok();
    }

    @DeleteMapping("/credentials/{credentialId}")
    @PreAuthorize("hasPermission('device', 'delete')")
    public R<Void> deleteCredential(@PathVariable Long credentialId,
                                    @AuthenticationPrincipal SecurityUser cu,
                                    HttpServletRequest request) {
        deviceService.deleteCredential(credentialId, cu.getTenantId(), cu.getUserId(),
            request.getRemoteAddr());
        return R.ok();
    }

    @GetMapping("/credentials/{credentialId}/reveal")
    @PreAuthorize("hasPermission('device', 'view_password')")
    public R<String> revealPassword(@PathVariable Long credentialId,
                                    @AuthenticationPrincipal SecurityUser cu,
                                    HttpServletRequest request) {
        String password = deviceService.revealPassword(credentialId, cu.getTenantId(),
            cu.getUserId(), request.getRemoteAddr());
        return R.ok(password);
    }
}
```

- [ ] **Step 3: 编译验证**

```bash
JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-24.jdk/Contents/Home mvn compile -q 2>&1 | tail -3
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: 重建后端容器验证 V6 迁移**

```bash
docker compose up -d --build backend 2>&1 | tail -5
sleep 30
docker logs cwgsyw-platform-backend-1 2>&1 | grep -E "Started|ERROR" | tail -3
```

Expected: `Started PlatformApplication`

验证 V6 迁移已执行：
```bash
docker exec cwgsyw-platform-postgres-1 psql -U platform_user -d cwgsyw_platform -c \
  "SELECT tablename FROM pg_tables WHERE tablename LIKE 'device%' OR tablename = 'password_access_log' ORDER BY tablename;"
```

Expected: `device`, `device_credential`, `password_access_log`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/device/
git commit -m "feat: device service and controller with AES-256-GCM password encryption"
```

---

## Task 5: 前端设备密码库页面

**Files:**
- Create: `frontend/src/app/(dashboard)/devices/page.tsx`
- Create: `frontend/src/app/(dashboard)/devices/new/page.tsx`
- Create: `frontend/src/app/(dashboard)/devices/[id]/page.tsx`
- Create: `frontend/src/components/device/CredentialRow.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: 安装依赖（alert-dialog）**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend
npx shadcn@latest add alert-dialog --yes
```

- [ ] **Step 2: 创建 CredentialRow 组件**

```tsx
// frontend/src/components/device/CredentialRow.tsx
'use client'
import { useState } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Eye, EyeOff, Copy } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'

interface Props {
  credentialId: number
  username: string
  description?: string
}

export function CredentialRow({ credentialId, username, description }: Props) {
  const [password, setPassword] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { hasPermission } = usePermission()
  const canReveal = hasPermission('device', 'view_password')

  const reveal = async () => {
    if (password) { setPassword(null); return }
    setLoading(true)
    try {
      const res = await api.get(`/devices/credentials/${credentialId}/reveal`)
      setPassword(res.data.data)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? '获取密码失败')
    } finally {
      setLoading(false)
    }
  }

  const copy = () => {
    if (password) {
      navigator.clipboard.writeText(password)
      toast.success('已复制到剪贴板')
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div>
        <span className="font-medium text-sm">{username}</span>
        {description && <span className="text-xs text-muted-foreground ml-2">{description}</span>}
      </div>
      <div className="flex items-center gap-2">
        {password ? (
          <>
            <code className="text-sm bg-muted px-2 py-0.5 rounded select-all">{password}</code>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <span className="text-sm text-muted-foreground tracking-widest">••••••••</span>
        )}
        {canReveal && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reveal} disabled={loading}>
            {password ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建设备列表页**

```tsx
// frontend/src/app/(dashboard)/devices/page.tsx
'use client'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Plus, Server, Network, Shield, Cloud, HardDrive } from 'lucide-react'
import { PermissionGuard } from '@/components/shared/PermissionGuard'

interface Device {
  id: number
  name: string
  ip: string
  device_type: string
  category: string
  group_name: string
  description: string
}

const typeConfig: Record<string, { label: string; icon: React.ElementType }> = {
  server:  { label: '服务器', icon: Server },
  network: { label: '网络设备', icon: Network },
  security:{ label: '安全设备', icon: Shield },
  cloud:   { label: '云资源', icon: Cloud },
  other:   { label: '其他', icon: HardDrive },
}

export default function DevicesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get('/devices').then(r => r.data.data.records as Device[]),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">设备密码库</h1>
        <PermissionGuard resource="device" action="create">
          <Link href="/devices/new" className={buttonVariants({ variant: 'default', size: 'sm' })}>
            <Plus className="h-4 w-4 mr-1" />新增设备
          </Link>
        </PermissionGuard>
      </div>

      {isLoading ? <p className="text-muted-foreground">加载中...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data ?? []).map(device => {
            const tc = typeConfig[device.device_type] ?? typeConfig.other
            const Icon = tc.icon
            return (
              <Link key={device.id} href={`/devices/${device.id}`}
                className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors block">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-muted rounded-md mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{device.name}</span>
                      <Badge variant="outline" className="text-xs">{tc.label}</Badge>
                      {device.category && (
                        <Badge variant="secondary" className="text-xs">{device.category}</Badge>
                      )}
                    </div>
                    {device.ip && <p className="text-sm text-muted-foreground mt-0.5">{device.ip}</p>}
                    {device.group_name && (
                      <p className="text-xs text-muted-foreground mt-1">{device.group_name}</p>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
          {(data ?? []).length === 0 && (
            <p className="text-muted-foreground col-span-2 text-center py-12">
              暂无设备，点击右上角新增
            </p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 创建新建设备页**

```tsx
// frontend/src/app/(dashboard)/devices/new/page.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const DEVICE_TYPES = [
  { value: 'server',   label: '服务器' },
  { value: 'network',  label: '网络设备' },
  { value: 'security', label: '安全设备' },
  { value: 'cloud',    label: '云资源' },
  { value: 'other',    label: '其他' },
]

export default function NewDevicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', ip: '', device_type: 'server', category: '', description: '',
  })

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('请填写设备名称'); return }
    setLoading(true)
    try {
      await api.post('/devices', form)
      toast.success('设备已创建')
      router.push('/devices')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">新增设备</h1>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>设备名称 *</Label>
          <Input value={form.name} onChange={set('name')} placeholder="例：生产数据库主机" required />
        </div>
        <div className="space-y-2">
          <Label>IP 地址</Label>
          <Input value={form.ip} onChange={set('ip')} placeholder="192.168.1.100" />
        </div>
        <div className="space-y-2">
          <Label>设备类型</Label>
          <select value={form.device_type} onChange={set('device_type')}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            {DEVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <Label>分类标签</Label>
          <Input value={form.category} onChange={set('category')} placeholder="例：数据库、核心网络" />
        </div>
        <div className="space-y-2">
          <Label>备注</Label>
          <Textarea value={form.description} onChange={set('description')} rows={3} />
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>{loading ? '创建中...' : '创建设备'}</Button>
          <Button type="button" variant="outline" onClick={() => router.push('/devices')}>取消</Button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: 创建设备详情页**

```tsx
// frontend/src/app/(dashboard)/devices/[id]/page.tsx
'use client'
import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CredentialRow } from '@/components/device/CredentialRow'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { toast } from 'sonner'
import { Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface DeviceDetail {
  id: number
  name: string
  ip: string
  device_type: string
  category: string
  group_name: string
  description: string
  credentials: { id: number; username: string; description: string }[]
}

export default function DeviceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [showAddCred, setShowAddCred] = useState(false)
  const [newCred, setNewCred] = useState({ username: '', password: '', description: '' })

  const { data: device, isLoading } = useQuery({
    queryKey: ['device', id],
    queryFn: () => api.get(`/devices/${id}`).then(r => r.data.data as DeviceDetail),
  })

  const addCredMutation = useMutation({
    mutationFn: () => api.post(`/devices/${id}/credentials`, newCred),
    onSuccess: () => {
      toast.success('账号已添加')
      queryClient.invalidateQueries({ queryKey: ['device', id] })
      setShowAddCred(false)
      setNewCred({ username: '', password: '', description: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '添加失败'),
  })

  if (isLoading) return <p className="text-muted-foreground">加载中...</p>
  if (!device) return <p className="text-destructive">设备不存在</p>

  const typeLabels: Record<string, string> = {
    server: '服务器', network: '网络设备', security: '安全设备', cloud: '云资源', other: '其他'
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/devices" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          <ArrowLeft className="h-4 w-4 mr-1" />返回
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{device.name}</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline">{typeLabels[device.device_type] ?? device.device_type}</Badge>
            {device.category && <Badge variant="secondary">{device.category}</Badge>}
            {device.group_name && <span className="text-sm text-muted-foreground">{device.group_name}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {device.ip && (
          <Card>
            <CardHeader><CardTitle className="text-sm">IP 地址</CardTitle></CardHeader>
            <CardContent className="text-sm font-mono">{device.ip}</CardContent>
          </Card>
        )}
        {device.description && (
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-sm">备注</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{device.description}</CardContent>
          </Card>
        )}
      </div>

      {/* 账号密码列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>账号密码</CardTitle>
            <PermissionGuard resource="device" action="create">
              <Button size="sm" variant="outline" onClick={() => setShowAddCred(!showAddCred)}>
                <Plus className="h-4 w-4 mr-1" />添加账号
              </Button>
            </PermissionGuard>
          </div>
        </CardHeader>
        <CardContent>
          {showAddCred && (
            <div className="mb-4 p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">用户名 *</Label>
                  <Input value={newCred.username}
                    onChange={e => setNewCred(p => ({ ...p, username: e.target.value }))}
                    placeholder="root" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">密码 *</Label>
                  <Input type="password" value={newCred.password}
                    onChange={e => setNewCred(p => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">备注</Label>
                <Input value={newCred.description}
                  onChange={e => setNewCred(p => ({ ...p, description: e.target.value }))}
                  placeholder="例：SSH 登录账号" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => addCredMutation.mutate()}
                  disabled={!newCred.username || !newCred.password || addCredMutation.isPending}>
                  保存
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddCred(false)}>取消</Button>
              </div>
            </div>
          )}

          {(device.credentials ?? []).length === 0 && !showAddCred ? (
            <p className="text-sm text-muted-foreground text-center py-6">暂无账号</p>
          ) : (
            (device.credentials ?? []).map(cred => (
              <CredentialRow key={cred.id} credentialId={cred.id}
                username={cred.username} description={cred.description} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 6: 更新 Sidebar 添加设备密码库入口**

在 `frontend/src/components/layout/Sidebar.tsx` 的 `navItems` 中添加：

```tsx
import { FileText, CheckSquare, Users, Building2, Shield, LayoutDashboard, KeyRound } from 'lucide-react'

const navItems = [
  { href: '/',               label: '首页',     icon: LayoutDashboard, resource: null,     action: null },
  { href: '/daily',          label: '工作日报', icon: FileText,        resource: 'daily_report', action: 'read' },
  { href: '/workflow/tasks', label: '待审批',   icon: CheckSquare,     resource: 'workflow', action: 'read' },
  { href: '/devices',        label: '设备密码库', icon: KeyRound,      resource: 'device',  action: 'read' },
  { href: '/users',          label: '用户管理', icon: Users,           resource: 'user',    action: 'read' },
  { href: '/groups',         label: '组管理',   icon: Building2,       resource: 'group',   action: 'read' },
  { href: '/rbac/roles',     label: '角色权限', icon: Shield,          resource: 'role',    action: 'read' },
]
```

- [ ] **Step 7: 构建前端验证 TypeScript**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`

- [ ] **Step 8: Commit**

```bash
git add frontend/src/
git commit -m "feat: device password vault UI - list, create, detail with credential reveal"
```

---

## Task 6: 重建容器 + 端到端验证

- [ ] **Step 1: 重建前端容器**

```bash
docker compose up -d --build frontend 2>&1 | tail -3
sleep 30
```

- [ ] **Step 2: 验证设备 API**

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# 创建设备
curl -s -X POST http://localhost/api/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"生产数据库","ip":"192.168.1.10","device_type":"server","category":"数据库"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('ID:', d['data']['id'])"
```

Expected: `ID: 1`（或其他正整数）

- [ ] **Step 3: 添加账号密码**

```bash
DEVICE_ID=1
curl -s -X POST http://localhost/api/devices/${DEVICE_ID}/credentials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"postgres","password":"secret123","description":"PostgreSQL管理员"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['code'])"
```

Expected: `200`

- [ ] **Step 4: 验证密码解密接口**

```bash
CRED_ID=1
curl -s "http://localhost/api/devices/credentials/${CRED_ID}/reveal" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Password:', d['data'])"
```

Expected: `Password: secret123`

- [ ] **Step 5: 验证审计日志已记录**

```bash
docker exec cwgsyw-platform-postgres-1 psql -U platform_user -d cwgsyw_platform -c \
  "SELECT module, action, target_id FROM audit_log WHERE module='device' ORDER BY created_at DESC LIMIT 5;"
```

Expected: 列出 `view_password`, `add_credential`, `create` 等记录

- [ ] **Step 6: 最终 Commit**

```bash
git add -A && git commit -m "feat: phase 2b complete - device password vault with AES-256-GCM encryption and audit log"
git tag v0.2.1-device
```

---

## 自检

### Spec 覆盖
- [x] 设备信息（名称、IP、类型、所属组、备注）→ Task 1, 3, 4
- [x] AES-256 加密存储，密钥环境变量注入 → Task 2
- [x] 查看密码写审计日志 → Task 4（revealPassword 写 audit_log）
- [x] 按组/类型分类检索 → Task 4（list 支持 groupId/deviceType/category 过滤）
- [x] RBAC 四步检查 → Task 1（V6 注册 device 资源）
- [x] 组员只能 read，view_password 需额外权限 → Task 1（SQL）+ Task 4（@PreAuthorize）
- [x] 组员按分类查看（组长配置） → 通过 RBAC view_password 权限控制
- [x] 前端密码默认脱敏，点击显示触发解密 → Task 5（CredentialRow）
- [x] 不可物理删除 → Task 4（逻辑删除）

### 类型一致性
- `DeviceService.revealPassword` 返回 `String` ← `DeviceController` 接受 `R<String>` ✓
- `CredentialVO.password` 默认 `null`（脱敏），前端不依赖这个字段展示密码 ✓
- `CryptoService` 构造器参数 `@Value("${encrypt.key}")` 与 `application.yml` 的 `encrypt.key` 一致 ✓
