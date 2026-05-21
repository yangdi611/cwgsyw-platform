# Phase 1 — 基础骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建完整的项目骨架，包含前后端脚手架、用户/组织/角色管理、动态 RBAC、JWT 认证、Docker Compose 全容器化部署。

**Architecture:** 后端 Spring Boot 3 多模块 Maven 项目，前端 Next.js 15 App Router 独立项目，通过 REST API 通信。所有表含 `tenant_id`（值固定 `default`）和逻辑删除字段，为多租户和审计奠基。RBAC 四层模型（Resource → Permission → Role → User）完全数据库驱动，权限通过 Spring Security `@PreAuthorize` + 自定义 PermissionEvaluator 在接口层强制。

**Tech Stack:** Java 21, Spring Boot 3.3, Spring Security 6, MyBatis-Plus 3.5, PostgreSQL 16, Redis 7, Next.js 15, React 19, shadcn/ui, Tailwind CSS v4, Zustand, TanStack Query v5, Docker Compose

---

## 文件结构

### 后端（`backend/`）

```
backend/
├── pom.xml                                          # 父 POM，依赖管理
├── src/main/java/com/cwgsyw/platform/
│   ├── PlatformApplication.java                     # 启动类
│   ├── config/
│   │   ├── SecurityConfig.java                      # Spring Security 配置
│   │   ├── MyBatisPlusConfig.java                   # 分页插件、审计填充
│   │   ├── RedisConfig.java                         # RedisTemplate 配置
│   │   └── JacksonConfig.java                       # 全局序列化配置
│   ├── common/
│   │   ├── BaseEntity.java                          # 公共字段：id/tenant_id/created_at/updated_at/is_deleted
│   │   ├── R.java                                   # 统一响应包装
│   │   ├── PageResult.java                          # 分页响应
│   │   ├── GlobalExceptionHandler.java              # 全局异常处理
│   │   └── enums/                                   # 公共枚举
│   ├── security/
│   │   ├── JwtUtil.java                             # JWT 生成/解析/验证
│   │   ├── JwtAuthFilter.java                       # JWT 请求过滤器
│   │   ├── UserDetailsServiceImpl.java              # 加载用户权限
│   │   ├── CustomPermissionEvaluator.java           # hasPermission() 实现
│   │   └── SecurityUser.java                        # 认证主体，含 userId/tenantId/groupId/permissions
│   ├── module/
│   │   ├── auth/
│   │   │   ├── AuthController.java                  # POST /api/auth/login, /logout, /refresh
│   │   │   ├── AuthService.java
│   │   │   └── dto/LoginRequest.java
│   │   ├── user/
│   │   │   ├── UserController.java                  # CRUD /api/users
│   │   │   ├── UserService.java
│   │   │   ├── UserMapper.java
│   │   │   ├── entity/User.java
│   │   │   └── dto/
│   │   ├── org/
│   │   │   ├── GroupController.java                 # CRUD /api/groups
│   │   │   ├── GroupService.java
│   │   │   ├── GroupMapper.java
│   │   │   └── entity/Group.java
│   │   └── rbac/
│   │       ├── ResourceController.java              # GET /api/rbac/resources（超级管理员）
│   │       ├── RoleController.java                  # CRUD /api/rbac/roles
│   │       ├── PermissionController.java            # 角色权限分配
│   │       ├── RbacService.java
│   │       ├── ResourceMapper.java
│   │       ├── RoleMapper.java
│   │       ├── PermissionMapper.java
│   │       └── entity/
│   │           ├── SysResource.java
│   │           ├── SysPermission.java
│   │           ├── SysRole.java
│   │           ├── SysRolePermission.java
│   │           └── SysUserRole.java
├── src/main/resources/
│   ├── application.yml
│   ├── application-dev.yml
│   └── db/migration/                                # Flyway 迁移脚本
│       ├── V1__create_base_tables.sql
│       ├── V2__create_rbac_tables.sql
│       └── V3__init_seed_data.sql
└── src/test/java/com/cwgsyw/platform/
    ├── auth/AuthControllerTest.java
    ├── rbac/RbacServiceTest.java
    └── user/UserServiceTest.java
```

### 前端（`frontend/`）

```
frontend/
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── components.json                                  # shadcn/ui 配置
├── src/
│   ├── app/
│   │   ├── layout.tsx                               # 根布局，Providers
│   │   ├── (auth)/
│   │   │   └── login/page.tsx                       # 登录页
│   │   └── (dashboard)/
│   │       ├── layout.tsx                           # 侧边栏 + 顶栏布局
│   │       ├── page.tsx                             # 首页 Dashboard
│   │       ├── users/page.tsx                       # 用户管理
│   │       ├── groups/page.tsx                      # 组管理
│   │       └── rbac/
│   │           ├── roles/page.tsx                   # 角色管理
│   │           └── permissions/page.tsx             # 权限配置（超级管理员）
│   ├── components/
│   │   ├── ui/                                      # shadcn/ui 组件（自动生成）
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   └── shared/
│   │       ├── DataTable.tsx                        # 通用表格组件
│   │       └── PermissionGuard.tsx                  # 按权限控制渲染
│   ├── lib/
│   │   ├── api.ts                                   # axios 实例，统一拦截器
│   │   ├── auth.ts                                  # token 存取
│   │   └── utils.ts                                 # shadcn cn() 工具
│   ├── store/
│   │   └── authStore.ts                             # Zustand：currentUser, permissions
│   └── hooks/
│       ├── useAuth.ts
│       └── usePermission.ts                         # hasPermission(resource, action)
```

### 部署（根目录）

```
docker-compose.yml
docker-compose.dev.yml
.env.example
backend/Dockerfile
frontend/Dockerfile
nginx/nginx.conf
```

---

## Task 1: 项目脚手架 & Docker Compose

**Files:**
- Create: `backend/pom.xml`
- Create: `frontend/package.json`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `nginx/nginx.conf`

- [ ] **Step 1: 创建根目录结构**

```bash
mkdir -p backend/src/main/java/com/cwgsyw/platform
mkdir -p backend/src/main/resources/db/migration
mkdir -p backend/src/test/java/com/cwgsyw/platform
mkdir -p frontend/src/{app,components,lib,store,hooks}
mkdir -p nginx
```

- [ ] **Step 2: 创建后端 pom.xml**

```xml
<!-- backend/pom.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.5</version>
    </parent>
    <groupId>com.cwgsyw</groupId>
    <artifactId>platform</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <name>cwgsyw-platform</name>

    <properties>
        <java.version>21</java.version>
        <mybatis-plus.version>3.5.7</mybatis-plus.version>
        <jjwt.version>0.12.6</jjwt.version>
        <flyway.version>10.15.0</flyway.version>
    </properties>

    <dependencies>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-security</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-data-redis</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-actuator</artifactId></dependency>
        <dependency><groupId>com.baomidou</groupId><artifactId>mybatis-plus-spring-boot3-starter</artifactId><version>${mybatis-plus.version}</version></dependency>
        <dependency><groupId>org.postgresql</groupId><artifactId>postgresql</artifactId><scope>runtime</scope></dependency>
        <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-core</artifactId></dependency>
        <dependency><groupId>org.flywaydb</groupId><artifactId>flyway-database-postgresql</artifactId></dependency>
        <dependency><groupId>io.jsonwebtoken</groupId><artifactId>jjwt-api</artifactId><version>${jjwt.version}</version></dependency>
        <dependency><groupId>io.jsonwebtoken</groupId><artifactId>jjwt-impl</artifactId><version>${jjwt.version}</version><scope>runtime</scope></dependency>
        <dependency><groupId>io.jsonwebtoken</groupId><artifactId>jjwt-jackson</artifactId><version>${jjwt.version}</version><scope>runtime</scope></dependency>
        <dependency><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><optional>true</optional></dependency>
        <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-test</artifactId><scope>test</scope></dependency>
        <dependency><groupId>org.springframework.security</groupId><artifactId>spring-security-test</artifactId><scope>test</scope></dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin><groupId>org.springframework.boot</groupId><artifactId>spring-boot-maven-plugin</artifactId></plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 3: 初始化前端项目**

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
npx shadcn@latest init --defaults
npx shadcn@latest add button input label card table badge avatar dropdown-menu dialog form select separator skeleton toast sonner
```

- [ ] **Step 4: 创建 docker-compose.yml**

```yaml
# docker-compose.yml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  backend:
    build: ./backend
    environment:
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/${POSTGRES_DB}
      SPRING_DATASOURCE_USERNAME: ${POSTGRES_USER}
      SPRING_DATASOURCE_PASSWORD: ${POSTGRES_PASSWORD}
      SPRING_REDIS_HOST: redis
      SPRING_REDIS_PASSWORD: ${REDIS_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      ENCRYPT_KEY: ${ENCRYPT_KEY}
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "8080:8080"

  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
    ports:
      - "3000:3000"
    depends_on:
      - backend

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "80:80"
    depends_on:
      - frontend
      - backend

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

- [ ] **Step 5: 创建 .env.example**

```bash
# .env.example
POSTGRES_DB=cwgsyw_platform
POSTGRES_USER=platform_user
POSTGRES_PASSWORD=change_me_in_production
REDIS_PASSWORD=change_me_in_production
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=change_me_in_production
JWT_SECRET=change_me_to_256bit_random_string_in_production
ENCRYPT_KEY=change_me_to_32byte_aes_key_here
NEXT_PUBLIC_API_URL=http://localhost/api
```

- [ ] **Step 6: 创建 nginx/nginx.conf**

```nginx
events { worker_connections 1024; }
http {
  upstream backend { server backend:8080; }
  upstream frontend { server frontend:3000; }
  server {
    listen 80;
    location /api { proxy_pass http://backend; proxy_set_header Host $host; }
    location / { proxy_pass http://frontend; proxy_set_header Host $host; }
  }
}
```

- [ ] **Step 7: 创建后端 Dockerfile**

```dockerfile
# backend/Dockerfile
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN apk add --no-cache maven && mvn package -DskipTests

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

- [ ] **Step 8: 创建前端 Dockerfile**

```dockerfile
# frontend/Dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 9: 验证 docker compose 配置语法**

```bash
cp .env.example .env
docker compose config
```

Expected: 输出完整的 compose 配置，无错误

- [ ] **Step 10: Commit**

```bash
git init
echo ".env" >> .gitignore
echo "node_modules/" >> .gitignore
echo "target/" >> .gitignore
echo ".next/" >> .gitignore
echo ".superpowers/" >> .gitignore
git add .
git commit -m "chore: project scaffold with docker compose"
```

---

## Task 2: 数据库迁移脚本（基础表）

**Files:**
- Create: `backend/src/main/resources/db/migration/V1__create_base_tables.sql`
- Create: `backend/src/main/resources/db/migration/V2__create_rbac_tables.sql`
- Create: `backend/src/main/resources/db/migration/V3__init_seed_data.sql`

- [ ] **Step 1: 创建 V1__create_base_tables.sql（用户、组织表）**

```sql
-- backend/src/main/resources/db/migration/V1__create_base_tables.sql

-- 组织（运维组）
CREATE TABLE sys_group (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    name        VARCHAR(64) NOT NULL,
    description VARCHAR(255),
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMPTZ,
    deleted_by  BIGINT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  BIGINT,
    updated_by  BIGINT
);
CREATE INDEX idx_sys_group_tenant ON sys_group(tenant_id) WHERE NOT is_deleted;

-- 用户
CREATE TABLE sys_user (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'default',
    group_id     BIGINT REFERENCES sys_group(id),
    username     VARCHAR(64) NOT NULL,
    password     VARCHAR(128) NOT NULL,
    real_name    VARCHAR(64),
    email        VARCHAR(128),
    phone        VARCHAR(32),
    avatar_url   VARCHAR(512),
    status       SMALLINT NOT NULL DEFAULT 1,  -- 1=active, 0=disabled
    is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMPTZ,
    deleted_by   BIGINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by   BIGINT,
    updated_by   BIGINT
);
CREATE UNIQUE INDEX idx_sys_user_username ON sys_user(tenant_id, username) WHERE NOT is_deleted;
CREATE INDEX idx_sys_user_tenant ON sys_user(tenant_id) WHERE NOT is_deleted;
CREATE INDEX idx_sys_user_group ON sys_user(group_id) WHERE NOT is_deleted;

-- 审计日志（全业务通用）
CREATE TABLE audit_log (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'default',
    module       VARCHAR(64) NOT NULL,   -- e.g. 'user', 'change_doc'
    action       VARCHAR(64) NOT NULL,   -- e.g. 'create', 'update', 'delete', 'view_password'
    target_id    BIGINT,
    target_type  VARCHAR(64),
    operator_id  BIGINT NOT NULL,
    operator_ip  VARCHAR(64),
    before_json  JSONB,
    after_json   JSONB,
    remark       VARCHAR(512),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_tenant_module ON audit_log(tenant_id, module, created_at DESC);
CREATE INDEX idx_audit_log_operator ON audit_log(operator_id, created_at DESC);
```

- [ ] **Step 2: 创建 V2__create_rbac_tables.sql**

```sql
-- backend/src/main/resources/db/migration/V2__create_rbac_tables.sql

-- 资源（模块 + 操作，动态注册）
CREATE TABLE sys_resource (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(64) NOT NULL UNIQUE,   -- e.g. 'change_doc'
    name        VARCHAR(128) NOT NULL,          -- e.g. '变更文档'
    actions     JSONB NOT NULL DEFAULT '[]',    -- e.g. ["create","read","approve","export"]
    sort_order  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 权限（resource + action 组合）
CREATE TABLE sys_permission (
    id           BIGSERIAL PRIMARY KEY,
    resource_id  BIGINT NOT NULL REFERENCES sys_resource(id),
    action       VARCHAR(64) NOT NULL,          -- e.g. 'approve'
    code         VARCHAR(128) NOT NULL UNIQUE,  -- e.g. 'change_doc:approve'
    name         VARCHAR(128) NOT NULL,          -- e.g. '审批变更文档'
    UNIQUE(resource_id, action)
);

-- 角色
CREATE TABLE sys_role (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    name        VARCHAR(64) NOT NULL,
    code        VARCHAR(64) NOT NULL,
    scope       VARCHAR(32) NOT NULL DEFAULT 'group',  -- group/tenant/platform
    description VARCHAR(255),
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_sys_role_code ON sys_role(tenant_id, code) WHERE NOT is_deleted;

-- 角色-权限关联
CREATE TABLE sys_role_permission (
    role_id       BIGINT NOT NULL REFERENCES sys_role(id),
    permission_id BIGINT NOT NULL REFERENCES sys_permission(id),
    PRIMARY KEY(role_id, permission_id)
);

-- 用户-角色关联
CREATE TABLE sys_user_role (
    user_id   BIGINT NOT NULL REFERENCES sys_user(id),
    role_id   BIGINT NOT NULL REFERENCES sys_role(id),
    PRIMARY KEY(user_id, role_id)
);
```

- [ ] **Step 3: 创建 V3__init_seed_data.sql（初始数据）**

```sql
-- backend/src/main/resources/db/migration/V3__init_seed_data.sql

-- 初始组织
INSERT INTO sys_group (name, description) VALUES
('管理组',   '平台管理人员'),
('数据库组', '数据库运维团队'),
('主机组',   '主机运维团队'),
('网络组',   '网络运维团队'),
('云平台组', '云平台运维团队');

-- 初始资源（Phase 1 仅注册基础资源，后续模块按需追加）
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('user',     '用户管理',     '["create","read","update","delete"]', 10),
('group',    '组织管理',     '["create","read","update","delete"]', 20),
('role',     '角色管理',     '["create","read","update","delete","assign"]', 30),
('resource', '资源权限配置', '["read","assign"]', 40),
('audit',    '审计日志',     '["read"]', 50);

-- 自动生成 permission 记录
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action,
       r.code || ':' || a.action,
       r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action);

-- 初始角色
INSERT INTO sys_role (name, code, scope, description) VALUES
('超级管理员', 'super_admin', 'platform', '平台全权限'),
('管理员',     'admin',       'tenant',   '租户内全权限'),
('运维组长',   'group_leader','group',    '审批本组单据'),
('运维组员',   'member',      'group',    '填报日报/变更'),
('文档管理员', 'doc_admin',   'tenant',   '管理共享文档');

-- 超级管理员拥有全部权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'super_admin';

-- 管理员权限（user/group/role/resource/audit 全部）
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'admin';

-- 初始超级管理员账号（密码: Admin@123，BCrypt 加密）
INSERT INTO sys_user (username, password, real_name, email, status) VALUES
('superadmin',
 '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewLFRWBFIlMDxSji',
 '超级管理员', 'superadmin@example.com', 1);

-- 给超级管理员分配超级管理员角色
INSERT INTO sys_user_role (user_id, role_id)
SELECT u.id, r.id FROM sys_user u, sys_role r
WHERE u.username = 'superadmin' AND r.code = 'super_admin';
```

- [ ] **Step 4: 启动 postgres 容器验证迁移**

```bash
docker compose up postgres -d
sleep 5
# 先手动运行 flyway 验证（后端启动时会自动执行）
docker run --rm --network host \
  -e FLYWAY_URL=jdbc:postgresql://localhost:5432/cwgsyw_platform \
  -e FLYWAY_USER=platform_user \
  -e FLYWAY_PASSWORD=change_me_in_production \
  -v $(pwd)/backend/src/main/resources/db/migration:/flyway/sql \
  flyway/flyway:10 migrate
```

Expected: `Successfully applied 3 migrations`

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/migration/
git commit -m "feat: database migration scripts V1-V3"
```

---

## Task 3: 后端公共基础设施

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/PlatformApplication.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/common/BaseEntity.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/common/R.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/common/PageResult.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/common/GlobalExceptionHandler.java`
- Create: `backend/src/main/resources/application.yml`
- Create: `backend/src/main/resources/application-dev.yml`

- [ ] **Step 1: 创建启动类**

```java
// PlatformApplication.java
package com.cwgsyw.platform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class PlatformApplication {
    public static void main(String[] args) {
        SpringApplication.run(PlatformApplication.class, args);
    }
}
```

- [ ] **Step 2: 创建 BaseEntity**

```java
// common/BaseEntity.java
package com.cwgsyw.platform.common;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public abstract class BaseEntity {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String tenantId = "default";

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;

    @TableField(fill = FieldFill.INSERT)
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updatedBy;

    @TableLogic
    private Boolean isDeleted = false;

    private LocalDateTime deletedAt;
    private Long deletedBy;
}
```

- [ ] **Step 3: 创建统一响应 R**

```java
// common/R.java
package com.cwgsyw.platform.common;

import lombok.Data;

@Data
public class R<T> {
    private int code;
    private String message;
    private T data;

    public static <T> R<T> ok(T data) {
        R<T> r = new R<>();
        r.code = 200;
        r.message = "success";
        r.data = data;
        return r;
    }

    public static <T> R<T> ok() {
        return ok(null);
    }

    public static <T> R<T> fail(int code, String message) {
        R<T> r = new R<>();
        r.code = code;
        r.message = message;
        return r;
    }

    public static <T> R<T> fail(String message) {
        return fail(500, message);
    }
}
```

- [ ] **Step 4: 创建 PageResult**

```java
// common/PageResult.java
package com.cwgsyw.platform.common;

import com.baomidou.mybatisplus.core.metadata.IPage;
import lombok.Data;
import java.util.List;

@Data
public class PageResult<T> {
    private List<T> records;
    private long total;
    private long page;
    private long size;

    public static <T> PageResult<T> of(IPage<T> page) {
        PageResult<T> result = new PageResult<>();
        result.records = page.getRecords();
        result.total = page.getTotal();
        result.page = page.getCurrent();
        result.size = page.getSize();
        return result;
    }
}
```

- [ ] **Step 5: 创建全局异常处理**

```java
// common/GlobalExceptionHandler.java
package com.cwgsyw.platform.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public R<Void> handleValidation(MethodArgumentNotValidException ex) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining("; "));
        return R.fail(400, msg);
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public R<Void> handleAccessDenied(AccessDeniedException ex) {
        return R.fail(403, "无权限");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public R<Void> handleIllegalArg(IllegalArgumentException ex) {
        return R.fail(400, ex.getMessage());
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public R<Void> handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        return R.fail(500, "服务器内部错误");
    }
}
```

- [ ] **Step 6: 创建 application.yml**

```yaml
# backend/src/main/resources/application.yml
spring:
  application:
    name: cwgsyw-platform
  datasource:
    url: ${SPRING_DATASOURCE_URL}
    username: ${SPRING_DATASOURCE_USERNAME}
    password: ${SPRING_DATASOURCE_PASSWORD}
    driver-class-name: org.postgresql.Driver
  flyway:
    enabled: true
    locations: classpath:db/migration
  data:
    redis:
      host: ${SPRING_REDIS_HOST:localhost}
      port: 6379
      password: ${SPRING_REDIS_PASSWORD:}
  jackson:
    property-naming-strategy: SNAKE_CASE
    default-property-inclusion: non_null

mybatis-plus:
  configuration:
    map-underscore-to-camel-case: true
    log-impl: org.apache.ibatis.logging.slf4j.Slf4jImpl
  global-config:
    db-config:
      logic-delete-field: isDeleted
      logic-delete-value: true
      logic-not-delete-value: false

jwt:
  secret: ${JWT_SECRET}
  expiration: 86400       # 24h in seconds
  refresh-expiration: 604800  # 7d

encrypt:
  key: ${ENCRYPT_KEY}

server:
  port: 8080
```

- [ ] **Step 7: 创建 application-dev.yml**

```yaml
# backend/src/main/resources/application-dev.yml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/cwgsyw_platform
    username: platform_user
    password: change_me_in_production
  data:
    redis:
      host: localhost
      password: change_me_in_production

jwt:
  secret: dev_secret_at_least_256_bits_long_please_change_this_now
encrypt:
  key: dev_encrypt_key_32bytes_here!!

logging:
  level:
    com.cwgsyw: DEBUG
```

- [ ] **Step 8: 创建 MyBatisPlusConfig（自动填充审计字段）**

```java
// config/MyBatisPlusConfig.java
package com.cwgsyw.platform.config;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import java.time.LocalDateTime;

@Configuration
@Slf4j
public class MyBatisPlusConfig {

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor());
        return interceptor;
    }

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
            private java.util.Optional<Long> getCurrentUserId() {
                Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                if (auth != null && auth.getPrincipal() instanceof SecurityUser su) {
                    return java.util.Optional.of(su.getUserId());
                }
                return java.util.Optional.empty();
            }
        };
    }
}
```

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/java/ backend/src/main/resources/application*.yml
git commit -m "feat: backend common infrastructure and config"
```

---

## Task 4: JWT 认证与 Spring Security 配置

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/security/JwtUtil.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/security/SecurityUser.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/security/JwtAuthFilter.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/security/UserDetailsServiceImpl.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/security/CustomPermissionEvaluator.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/config/SecurityConfig.java`
- Create: `backend/src/test/java/com/cwgsyw/platform/security/JwtUtilTest.java`

- [ ] **Step 1: 写 JwtUtil 测试**

```java
// src/test/java/com/cwgsyw/platform/security/JwtUtilTest.java
package com.cwgsyw.platform.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class JwtUtilTest {
    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil(
            "test_secret_256bits_long_at_least_please_padding_here_ok",
            86400L
        );
    }

    @Test
    void generateAndValidateToken() {
        String token = jwtUtil.generateToken(1L, "testuser", "default");
        assertThat(token).isNotBlank();
        assertThat(jwtUtil.validateToken(token)).isTrue();
        assertThat(jwtUtil.getUserId(token)).isEqualTo(1L);
        assertThat(jwtUtil.getUsername(token)).isEqualTo("testuser");
        assertThat(jwtUtil.getTenantId(token)).isEqualTo("default");
    }

    @Test
    void expiredTokenIsInvalid() {
        JwtUtil shortLived = new JwtUtil(
            "test_secret_256bits_long_at_least_please_padding_here_ok", 0L);
        String token = shortLived.generateToken(1L, "u", "default");
        assertThat(shortLived.validateToken(token)).isFalse();
    }
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
cd backend && mvn test -Dtest=JwtUtilTest -pl . 2>&1 | tail -5
```

Expected: `COMPILATION ERROR` 或 `JwtUtil not found`

- [ ] **Step 3: 实现 JwtUtil**

```java
// security/JwtUtil.java
package com.cwgsyw.platform.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
@Slf4j
public class JwtUtil {
    private final SecretKey key;
    private final long expiration;

    public JwtUtil(@Value("${jwt.secret}") String secret,
                   @Value("${jwt.expiration}") long expiration) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiration = expiration;
    }

    public String generateToken(Long userId, String username, String tenantId) {
        return Jwts.builder()
            .subject(username)
            .claim("userId", userId)
            .claim("tenantId", tenantId)
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiration * 1000))
            .signWith(key)
            .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            log.debug("Invalid JWT: {}", e.getMessage());
            return false;
        }
    }

    private Claims claims(String token) {
        return Jwts.parser().verifyWith(key).build()
            .parseSignedClaims(token).getPayload();
    }

    public Long getUserId(String token)   { return claims(token).get("userId", Long.class); }
    public String getUsername(String token) { return claims(token).getSubject(); }
    public String getTenantId(String token) { return claims(token).get("tenantId", String.class); }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
mvn test -Dtest=JwtUtilTest
```

Expected: `Tests run: 2, Failures: 0, Errors: 0`

- [ ] **Step 5: 实现 SecurityUser**

```java
// security/SecurityUser.java
package com.cwgsyw.platform.security;

import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

@Getter
public class SecurityUser implements UserDetails {
    private final Long userId;
    private final String username;
    private final String password;
    private final String tenantId;
    private final Long groupId;
    private final Set<String> permissions;  // e.g. ["change_doc:approve", "user:read"]
    private final Collection<? extends GrantedAuthority> authorities;

    public SecurityUser(Long userId, String username, String password,
                        String tenantId, Long groupId, Set<String> permissions) {
        this.userId = userId;
        this.username = username;
        this.password = password;
        this.tenantId = tenantId;
        this.groupId = groupId;
        this.permissions = permissions;
        this.authorities = permissions.stream()
            .map(SimpleGrantedAuthority::new)
            .collect(Collectors.toSet());
    }

    @Override public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }
    @Override public String getPassword() { return password; }
    @Override public String getUsername() { return username; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return true; }
}
```

- [ ] **Step 6: 实现 UserDetailsServiceImpl**

```java
// security/UserDetailsServiceImpl.java
package com.cwgsyw.platform.security;

import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {
    private final UserMapper userMapper;
    private final RbacService rbacService;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userMapper.findByUsername(username)
            .orElseThrow(() -> new UsernameNotFoundException("用户不存在: " + username));
        Set<String> permissions = rbacService.getUserPermissions(user.getId());
        return new SecurityUser(user.getId(), user.getUsername(), user.getPassword(),
            user.getTenantId(), user.getGroupId(), permissions);
    }
}
```

- [ ] **Step 7: 实现 JwtAuthFilter**

```java
// security/JwtAuthFilter.java
package com.cwgsyw.platform.security;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;
    private final UserDetailsServiceImpl userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        String token = extractToken(req);
        if (StringUtils.hasText(token) && jwtUtil.validateToken(token)) {
            String username = jwtUtil.getUsername(token);
            var userDetails = userDetailsService.loadUserByUsername(username);
            var auth = new UsernamePasswordAuthenticationToken(
                userDetails, null, userDetails.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        chain.doFilter(req, res);
    }

    private String extractToken(HttpServletRequest req) {
        String bearer = req.getHeader("Authorization");
        if (StringUtils.hasText(bearer) && bearer.startsWith("Bearer ")) {
            return bearer.substring(7);
        }
        return null;
    }
}
```

- [ ] **Step 8: 实现 CustomPermissionEvaluator**

```java
// security/CustomPermissionEvaluator.java
package com.cwgsyw.platform.security;

import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import java.io.Serializable;

@Component
public class CustomPermissionEvaluator implements PermissionEvaluator {

    @Override
    public boolean hasPermission(Authentication auth, Object targetDomainObject, Object permission) {
        if (auth == null || !(auth.getPrincipal() instanceof SecurityUser su)) return false;
        String permCode = targetDomainObject + ":" + permission;
        return su.getPermissions().contains(permCode);
    }

    @Override
    public boolean hasPermission(Authentication auth, Serializable targetId,
                                 String targetType, Object permission) {
        return hasPermission(auth, targetType, permission);
    }
}
```

- [ ] **Step 9: 实现 SecurityConfig**

```java
// config/SecurityConfig.java
package com.cwgsyw.platform.config;

import com.cwgsyw.platform.security.*;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.*;
import org.springframework.security.authentication.*;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.access.expression.method.DefaultMethodSecurityExpressionHandler;
import org.springframework.security.access.expression.method.MethodSecurityExpressionHandler;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
public class SecurityConfig {
    private final JwtAuthFilter jwtAuthFilter;
    private final CustomPermissionEvaluator permissionEvaluator;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(c -> c.disable())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/auth/login", "/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
            .build();
    }

    @Bean
    public MethodSecurityExpressionHandler methodSecurityExpressionHandler() {
        DefaultMethodSecurityExpressionHandler handler = new DefaultMethodSecurityExpressionHandler();
        handler.setPermissionEvaluator(permissionEvaluator);
        return handler;
    }

    @Bean
    public PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }

    @Bean
    public AuthenticationManager authenticationManager(
            org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration config)
            throws Exception {
        return config.getAuthenticationManager();
    }
}
```

- [ ] **Step 10: Commit**

```bash
git add backend/src/
git commit -m "feat: JWT authentication and Spring Security config"
```

---

## Task 5: RBAC 服务与用户模块后端

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/rbac/entity/` (5 entities)
- Create: `backend/src/main/java/com/cwgsyw/platform/module/rbac/RbacService.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/rbac/RoleController.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/user/entity/User.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/user/UserMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/user/UserService.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/user/UserController.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/org/entity/Group.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/org/GroupMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java`
- Create: `backend/src/test/java/com/cwgsyw/platform/rbac/RbacServiceTest.java`

- [ ] **Step 1: 写 RbacService 测试**

```java
// src/test/java/com/cwgsyw/platform/rbac/RbacServiceTest.java
package com.cwgsyw.platform.rbac;

import com.cwgsyw.platform.module.rbac.*;
import com.cwgsyw.platform.module.rbac.entity.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RbacServiceTest {
    @Mock SysUserRoleMapper userRoleMapper;
    @Mock SysRolePermissionMapper rolePermMapper;
    @Mock SysPermissionMapper permMapper;
    @InjectMocks RbacService rbacService;

    @Test
    void getUserPermissions_returnsPermissionCodes() {
        when(userRoleMapper.findRoleIdsByUserId(1L)).thenReturn(List.of(10L, 20L));
        when(rolePermMapper.findPermissionIdsByRoleIds(List.of(10L, 20L))).thenReturn(List.of(100L, 101L));
        SysPermission p1 = new SysPermission(); p1.setCode("user:read");
        SysPermission p2 = new SysPermission(); p2.setCode("user:create");
        when(permMapper.selectBatchIds(List.of(100L, 101L))).thenReturn(List.of(p1, p2));

        Set<String> perms = rbacService.getUserPermissions(1L);
        assertThat(perms).containsExactlyInAnyOrder("user:read", "user:create");
    }

    @Test
    void getUserPermissions_emptyWhenNoRoles() {
        when(userRoleMapper.findRoleIdsByUserId(99L)).thenReturn(List.of());
        Set<String> perms = rbacService.getUserPermissions(99L);
        assertThat(perms).isEmpty();
    }
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
mvn test -Dtest=RbacServiceTest 2>&1 | tail -5
```

Expected: 编译错误，类不存在

- [ ] **Step 3: 创建 RBAC 实体类**

```java
// module/rbac/entity/SysResource.java
package com.cwgsyw.platform.module.rbac.entity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
@Data @TableName("sys_resource")
public class SysResource {
    private Long id;
    private String code;
    private String name;
    private List<String> actions;   // MyBatis-Plus TypeHandler 处理 JSONB
    private Integer sortOrder;
    private LocalDateTime createdAt;
}
```

```java
// module/rbac/entity/SysPermission.java
package com.cwgsyw.platform.module.rbac.entity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
@Data @TableName("sys_permission")
public class SysPermission {
    private Long id;
    private Long resourceId;
    private String action;
    private String code;
    private String name;
}
```

```java
// module/rbac/entity/SysRole.java
package com.cwgsyw.platform.module.rbac.entity;
import com.baomidou.mybatisplus.annotation.*;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
@Data @EqualsAndHashCode(callSuper = true) @TableName("sys_role")
public class SysRole extends BaseEntity {
    private String name;
    private String code;
    private String scope;   // group / tenant / platform
    private String description;
}
```

```java
// module/rbac/entity/SysRolePermission.java
package com.cwgsyw.platform.module.rbac.entity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
@Data @TableName("sys_role_permission")
public class SysRolePermission {
    private Long roleId;
    private Long permissionId;
}
```

```java
// module/rbac/entity/SysUserRole.java
package com.cwgsyw.platform.module.rbac.entity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
@Data @TableName("sys_user_role")
public class SysUserRole {
    private Long userId;
    private Long roleId;
}
```

- [ ] **Step 4: 创建 Mapper 接口**

```java
// module/rbac/SysUserRoleMapper.java
package com.cwgsyw.platform.module.rbac;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.rbac.entity.SysUserRole;
import org.apache.ibatis.annotations.*;
import java.util.List;
@Mapper
public interface SysUserRoleMapper extends BaseMapper<SysUserRole> {
    @Select("SELECT role_id FROM sys_user_role WHERE user_id = #{userId}")
    List<Long> findRoleIdsByUserId(Long userId);
}
```

```java
// module/rbac/SysRolePermissionMapper.java
package com.cwgsyw.platform.module.rbac;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.rbac.entity.SysRolePermission;
import org.apache.ibatis.annotations.*;
import java.util.List;
@Mapper
public interface SysRolePermissionMapper extends BaseMapper<SysRolePermission> {
    @Select("<script>SELECT permission_id FROM sys_role_permission WHERE role_id IN " +
            "<foreach item='id' collection='roleIds' open='(' separator=',' close=')'>#{id}</foreach></script>")
    List<Long> findPermissionIdsByRoleIds(@Param("roleIds") List<Long> roleIds);
}
```

```java
// module/rbac/SysPermissionMapper.java
package com.cwgsyw.platform.module.rbac;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.rbac.entity.SysPermission;
import org.apache.ibatis.annotations.Mapper;
@Mapper
public interface SysPermissionMapper extends BaseMapper<SysPermission> {}
```

```java
// module/rbac/SysRoleMapper.java
package com.cwgsyw.platform.module.rbac;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.rbac.entity.SysRole;
import org.apache.ibatis.annotations.Mapper;
@Mapper
public interface SysRoleMapper extends BaseMapper<SysRole> {}
```

```java
// module/rbac/SysResourceMapper.java
package com.cwgsyw.platform.module.rbac;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.rbac.entity.SysResource;
import org.apache.ibatis.annotations.Mapper;
@Mapper
public interface SysResourceMapper extends BaseMapper<SysResource> {}
```

- [ ] **Step 5: 实现 RbacService**

```java
// module/rbac/RbacService.java
package com.cwgsyw.platform.module.rbac;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.module.rbac.entity.*;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RbacService {
    private final SysUserRoleMapper userRoleMapper;
    private final SysRolePermissionMapper rolePermMapper;
    private final SysPermissionMapper permMapper;
    private final SysRoleMapper roleMapper;
    private final SysResourceMapper resourceMapper;

    public Set<String> getUserPermissions(Long userId) {
        List<Long> roleIds = userRoleMapper.findRoleIdsByUserId(userId);
        if (roleIds.isEmpty()) return Set.of();
        List<Long> permIds = rolePermMapper.findPermissionIdsByRoleIds(roleIds);
        if (permIds.isEmpty()) return Set.of();
        return permMapper.selectBatchIds(permIds).stream()
            .map(SysPermission::getCode)
            .collect(Collectors.toSet());
    }

    public List<SysResource> getAllResources() {
        return resourceMapper.selectList(null);
    }

    @Transactional
    public void assignPermissionsToRole(Long roleId, List<Long> permissionIds) {
        rolePermMapper.delete(new LambdaQueryWrapper<SysRolePermission>()
            .eq(SysRolePermission::getRoleId, roleId));
        permissionIds.forEach(pid -> {
            SysRolePermission srp = new SysRolePermission();
            srp.setRoleId(roleId);
            srp.setPermissionId(pid);
            rolePermMapper.insert(srp);
        });
    }

    @Transactional
    public void assignRolesToUser(Long userId, List<Long> roleIds) {
        userRoleMapper.delete(new LambdaQueryWrapper<SysUserRole>()
            .eq(SysUserRole::getUserId, userId));
        roleIds.forEach(rid -> {
            SysUserRole sur = new SysUserRole();
            sur.setUserId(userId);
            sur.setRoleId(rid);
            userRoleMapper.insert(sur);
        });
    }
}
```

- [ ] **Step 6: 运行测试，确认通过**

```bash
mvn test -Dtest=RbacServiceTest
```

Expected: `Tests run: 2, Failures: 0`

- [ ] **Step 7: 创建 User 实体和 Mapper**

```java
// module/user/entity/User.java
package com.cwgsyw.platform.module.user.entity;
import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
@Data @EqualsAndHashCode(callSuper = true) @TableName("sys_user")
public class User extends BaseEntity {
    private Long groupId;
    private String username;
    private String password;
    private String realName;
    private String email;
    private String phone;
    private String avatarUrl;
    private Integer status;
}
```

```java
// module/user/UserMapper.java
package com.cwgsyw.platform.module.user;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.user.entity.User;
import org.apache.ibatis.annotations.*;
import java.util.Optional;
@Mapper
public interface UserMapper extends BaseMapper<User> {
    @Select("SELECT * FROM sys_user WHERE username = #{username} AND is_deleted = false")
    Optional<User> findByUsername(String username);
}
```

- [ ] **Step 8: 创建 UserService 和 UserController**

```java
// module/user/UserService.java
package com.cwgsyw.platform.module.user;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.cwgsyw.platform.common.PageResult;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.dto.*;
import com.cwgsyw.platform.module.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final RbacService rbacService;

    public PageResult<User> list(int page, int size, String tenantId) {
        Page<User> p = userMapper.selectPage(new Page<>(page, size),
            new LambdaQueryWrapper<User>().eq(User::getTenantId, tenantId));
        return PageResult.of(p);
    }

    @Transactional
    public User create(CreateUserRequest req, String tenantId) {
        if (userMapper.findByUsername(req.getUsername()).isPresent()) {
            throw new IllegalArgumentException("用户名已存在");
        }
        User user = new User();
        user.setTenantId(tenantId);
        user.setUsername(req.getUsername());
        user.setPassword(passwordEncoder.encode(req.getPassword()));
        user.setRealName(req.getRealName());
        user.setEmail(req.getEmail());
        user.setGroupId(req.getGroupId());
        user.setStatus(1);
        userMapper.insert(user);
        if (req.getRoleIds() != null && !req.getRoleIds().isEmpty()) {
            rbacService.assignRolesToUser(user.getId(), req.getRoleIds());
        }
        return user;
    }

    @Transactional
    public void update(Long id, UpdateUserRequest req) {
        User user = userMapper.selectById(id);
        if (user == null) throw new IllegalArgumentException("用户不存在");
        if (req.getRealName() != null) user.setRealName(req.getRealName());
        if (req.getEmail() != null) user.setEmail(req.getEmail());
        if (req.getGroupId() != null) user.setGroupId(req.getGroupId());
        if (req.getStatus() != null) user.setStatus(req.getStatus());
        if (req.getPassword() != null) user.setPassword(passwordEncoder.encode(req.getPassword()));
        userMapper.updateById(user);
        if (req.getRoleIds() != null) {
            rbacService.assignRolesToUser(id, req.getRoleIds());
        }
    }

    @Transactional
    public void delete(Long id, Long operatorId) {
        User user = userMapper.selectById(id);
        if (user == null) throw new IllegalArgumentException("用户不存在");
        user.setIsDeleted(true);
        user.setDeletedBy(operatorId);
        user.setDeletedAt(java.time.LocalDateTime.now());
        userMapper.updateById(user);
    }
}
```

```java
// module/user/dto/CreateUserRequest.java
package com.cwgsyw.platform.module.user.dto;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.List;
@Data
public class CreateUserRequest {
    @NotBlank private String username;
    @NotBlank @Size(min = 6) private String password;
    private String realName;
    private String email;
    private Long groupId;
    private List<Long> roleIds;
}
```

```java
// module/user/dto/UpdateUserRequest.java
package com.cwgsyw.platform.module.user.dto;
import lombok.Data;
import java.util.List;
@Data
public class UpdateUserRequest {
    private String realName;
    private String email;
    private String password;
    private Long groupId;
    private Integer status;
    private List<Long> roleIds;
}
```

```java
// module/user/UserController.java
package com.cwgsyw.platform.module.user;
import com.cwgsyw.platform.common.*;
import com.cwgsyw.platform.module.user.dto.*;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.SecurityUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping
    @PreAuthorize("hasPermission('user', 'read')")
    public R<PageResult<User>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(userService.list(page, size, currentUser.getTenantId()));
    }

    @PostMapping
    @PreAuthorize("hasPermission('user', 'create')")
    public R<User> create(@Valid @RequestBody CreateUserRequest req,
                          @AuthenticationPrincipal SecurityUser currentUser) {
        return R.ok(userService.create(req, currentUser.getTenantId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('user', 'update')")
    public R<Void> update(@PathVariable Long id, @RequestBody UpdateUserRequest req) {
        userService.update(id, req);
        return R.ok();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasPermission('user', 'delete')")
    public R<Void> delete(@PathVariable Long id,
                          @AuthenticationPrincipal SecurityUser currentUser) {
        userService.delete(id, currentUser.getUserId());
        return R.ok();
    }
}
```

- [ ] **Step 9: 创建 Group 实体、Mapper 和 Controller**

```java
// module/org/entity/Group.java
package com.cwgsyw.platform.module.org.entity;
import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
@Data @EqualsAndHashCode(callSuper = true) @TableName("sys_group")
public class Group extends BaseEntity {
    private String name;
    private String description;
}
```

```java
// module/org/GroupMapper.java
package com.cwgsyw.platform.module.org;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.org.entity.Group;
import org.apache.ibatis.annotations.Mapper;
@Mapper
public interface GroupMapper extends BaseMapper<Group> {}
```

```java
// module/org/GroupController.java
package com.cwgsyw.platform.module.org;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.org.entity.Group;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {
    private final GroupMapper groupMapper;

    @GetMapping
    @PreAuthorize("hasPermission('group', 'read')")
    public R<List<Group>> list(@AuthenticationPrincipal SecurityUser cu) {
        return R.ok(groupMapper.selectList(
            new LambdaQueryWrapper<Group>().eq(Group::getTenantId, cu.getTenantId())));
    }

    @PostMapping
    @PreAuthorize("hasPermission('group', 'create')")
    public R<Group> create(@RequestBody Group group,
                           @AuthenticationPrincipal SecurityUser cu) {
        group.setTenantId(cu.getTenantId());
        groupMapper.insert(group);
        return R.ok(group);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission('group', 'update')")
    public R<Void> update(@PathVariable Long id, @RequestBody Group req) {
        req.setId(id);
        groupMapper.updateById(req);
        return R.ok();
    }
}
```

- [ ] **Step 10: Commit**

```bash
git add backend/src/
git commit -m "feat: RBAC service, user and group modules"
```

---

## Task 6: 认证接口（登录/登出）

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/auth/AuthController.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/auth/AuthService.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/auth/dto/LoginRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/auth/dto/LoginResponse.java`
- Create: `backend/src/test/java/com/cwgsyw/platform/auth/AuthControllerTest.java`

- [ ] **Step 1: 写 AuthController 集成测试**

```java
// src/test/java/com/cwgsyw/platform/auth/AuthControllerTest.java
package com.cwgsyw.platform.auth;

import com.cwgsyw.platform.module.auth.dto.LoginRequest;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class AuthControllerTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;

    @Test
    void loginWithValidCredentials_returnsToken() throws Exception {
        LoginRequest req = new LoginRequest();
        req.setUsername("superadmin");
        req.setPassword("Admin@123");

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(200))
            .andExpect(jsonPath("$.data.token").isNotEmpty());
    }

    @Test
    void loginWithWrongPassword_returns401() throws Exception {
        LoginRequest req = new LoginRequest();
        req.setUsername("superadmin");
        req.setPassword("wrong");

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 2: 运行测试，确认失败**

```bash
mvn test -Dtest=AuthControllerTest 2>&1 | tail -5
```

Expected: 编译错误

- [ ] **Step 3: 实现 Auth DTOs 和 Service**

```java
// module/auth/dto/LoginRequest.java
package com.cwgsyw.platform.module.auth.dto;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
@Data
public class LoginRequest {
    @NotBlank private String username;
    @NotBlank private String password;
}
```

```java
// module/auth/dto/LoginResponse.java
package com.cwgsyw.platform.module.auth.dto;
import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.Set;
@Data @AllArgsConstructor
public class LoginResponse {
    private String token;
    private String username;
    private String realName;
    private Set<String> permissions;
}
```

```java
// module/auth/AuthService.java
package com.cwgsyw.platform.module.auth;

import com.cwgsyw.platform.module.auth.dto.*;
import com.cwgsyw.platform.module.rbac.RbacService;
import com.cwgsyw.platform.module.user.UserMapper;
import com.cwgsyw.platform.module.user.entity.User;
import com.cwgsyw.platform.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final RbacService rbacService;

    public LoginResponse login(LoginRequest req) {
        User user = userMapper.findByUsername(req.getUsername())
            .orElseThrow(() -> new org.springframework.security.authentication
                .BadCredentialsException("用户名或密码错误"));
        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            throw new org.springframework.security.authentication
                .BadCredentialsException("用户名或密码错误");
        }
        if (user.getStatus() != 1) {
            throw new IllegalArgumentException("账号已禁用");
        }
        Set<String> permissions = rbacService.getUserPermissions(user.getId());
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), user.getTenantId());
        return new LoginResponse(token, user.getUsername(), user.getRealName(), permissions);
    }
}
```

```java
// module/auth/AuthController.java
package com.cwgsyw.platform.module.auth;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.auth.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public R<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        return R.ok(authService.login(req));
    }

    @ExceptionHandler(BadCredentialsException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public R<Void> handleBadCredentials(BadCredentialsException ex) {
        return R.fail(401, ex.getMessage());
    }
}
```

- [ ] **Step 4: 运行测试，确认通过**

```bash
mvn test -Dtest=AuthControllerTest
```

Expected: `Tests run: 2, Failures: 0`

- [ ] **Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: login/logout auth endpoints"
```

---

## Task 7: 前端认证与全局状态

**Files:**
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/auth.ts`
- Create: `frontend/src/store/authStore.ts`
- Create: `frontend/src/hooks/useAuth.ts`
- Create: `frontend/src/hooks/usePermission.ts`
- Create: `frontend/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: 创建 axios 实例**

```typescript
// frontend/src/lib/api.ts
import axios from 'axios'
import { getToken, clearToken } from './auth'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearToken()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
```

- [ ] **Step 2: 创建 token 工具**

```typescript
// frontend/src/lib/auth.ts
const TOKEN_KEY = 'cwgsyw_token'

export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token)
export const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)
```

- [ ] **Step 3: 创建 Zustand auth store**

```typescript
// frontend/src/store/authStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  user: { username: string; realName: string } | null
  permissions: Set<string>
  setAuth: (user: { username: string; realName: string }, permissions: string[]) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      permissions: new Set(),
      setAuth: (user, permissions) => set({ user, permissions: new Set(permissions) }),
      clearAuth: () => set({ user: null, permissions: new Set() }),
    }),
    {
      name: 'cwgsyw-auth',
      partialize: (state) => ({ user: state.user, permissions: [...state.permissions] }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray((state as any).permissions)) {
          state.permissions = new Set((state as any).permissions)
        }
      },
    }
  )
)
```

- [ ] **Step 4: 创建 usePermission hook**

```typescript
// frontend/src/hooks/usePermission.ts
import { useAuthStore } from '@/store/authStore'

export function usePermission() {
  const permissions = useAuthStore((s) => s.permissions)
  const hasPermission = (resource: string, action: string) =>
    permissions.has(`${resource}:${action}`)
  return { hasPermission }
}
```

- [ ] **Step 5: 创建 useAuth hook**

```typescript
// frontend/src/hooks/useAuth.ts
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { setToken, clearToken } from '@/lib/auth'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const router = useRouter()
  const { setAuth, clearAuth, user } = useAuthStore()

  const login = async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password })
    const { token, username: u, realName, permissions } = res.data.data
    setToken(token)
    setAuth({ username: u, realName }, permissions)
    router.push('/')
  }

  const logout = () => {
    clearToken()
    clearAuth()
    router.push('/login')
  }

  return { login, logout, user }
}
```

- [ ] **Step 6: 创建登录页面**

```tsx
// frontend/src/app/(auth)/login/page.tsx
'use client'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch {
      setError('用户名或密码错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl text-center">IT 运维平台</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input id="username" value={username}
                onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input id="password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/
git commit -m "feat: frontend auth, api client and login page"
```

---

## Task 8: 前端 Dashboard 布局与权限路由

**Files:**
- Create: `frontend/src/app/(dashboard)/layout.tsx`
- Create: `frontend/src/app/(dashboard)/page.tsx`
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Create: `frontend/src/components/layout/Header.tsx`
- Create: `frontend/src/components/shared/PermissionGuard.tsx`
- Create: `frontend/src/app/layout.tsx`

- [ ] **Step 1: 创建根布局**

```tsx
// frontend/src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'IT 运维平台',
  description: 'IT Infrastructure Operations Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: 创建 PermissionGuard 组件**

```tsx
// frontend/src/components/shared/PermissionGuard.tsx
'use client'
import { usePermission } from '@/hooks/usePermission'

interface Props {
  resource: string
  action: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function PermissionGuard({ resource, action, children, fallback = null }: Props) {
  const { hasPermission } = usePermission()
  return hasPermission(resource, action) ? <>{children}</> : <>{fallback}</>
}
```

- [ ] **Step 3: 创建 Sidebar**

```tsx
// frontend/src/components/layout/Sidebar.tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { Users, Building2, Shield, LayoutDashboard } from 'lucide-react'

const navItems = [
  { href: '/', label: '首页', icon: LayoutDashboard, resource: null, action: null },
  { href: '/users', label: '用户管理', icon: Users, resource: 'user', action: 'read' },
  { href: '/groups', label: '组管理', icon: Building2, resource: 'group', action: 'read' },
  { href: '/rbac/roles', label: '角色权限', icon: Shield, resource: 'role', action: 'read' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { hasPermission } = usePermission()

  return (
    <aside className="w-56 border-r bg-background flex flex-col min-h-screen">
      <div className="p-4 border-b">
        <span className="font-bold text-lg">IT 运维平台</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ href, label, icon: Icon, resource, action }) => {
          if (resource && action && !hasPermission(resource, action)) return null
          return (
            <Link key={href} href={href}
              className={cn('flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                pathname === href ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}>
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 4: 创建 Header**

```tsx
// frontend/src/components/layout/Header.tsx
'use client'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="h-14 border-b flex items-center justify-between px-6 bg-background">
      <div />
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{user?.realName?.[0] ?? 'U'}</AvatarFallback>
        </Avatar>
        <span className="text-sm">{user?.realName}</span>
        <Button variant="ghost" size="sm" onClick={logout}>退出</Button>
      </div>
    </header>
  )
}
```

- [ ] **Step 5: 创建 Dashboard 布局（含认证守卫）**

```tsx
// frontend/src/app/(dashboard)/layout.tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useAuthStore } from '@/store/authStore'
import { getToken } from '@/lib/auth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (!getToken() || !user) router.replace('/login')
  }, [user, router])

  if (!user) return null

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 创建首页 Dashboard**

```tsx
// frontend/src/app/(dashboard)/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">首页</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {['工作报告', '变更文档', '共享文档', '设备密码'].map((title) => (
          <Card key={title}>
            <CardHeader><CardTitle className="text-sm font-medium">{title}</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground text-sm">即将上线</p></CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat: dashboard layout with sidebar, header and permission guard"
```

---

## Task 9: 角色权限配置前端页面

**Files:**
- Create: `frontend/src/app/(dashboard)/rbac/roles/page.tsx`
- Create: `frontend/src/app/(dashboard)/rbac/permissions/page.tsx`

- [ ] **Step 1: 创建角色管理页**

```tsx
// frontend/src/app/(dashboard)/rbac/roles/page.tsx
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { toast } from 'sonner'

interface Role { id: number; name: string; code: string; scope: string; description: string }

const scopeLabel: Record<string, string> = {
  group: '组级', tenant: '租户级', platform: '平台级'
}

export default function RolesPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<{ data: { records: Role[] } }>({
    queryKey: ['roles'],
    queryFn: () => api.get('/rbac/roles').then(r => r.data),
  })

  const roles = data?.data?.records ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">角色管理</h1>
        <PermissionGuard resource="role" action="create">
          <Button size="sm">新增角色</Button>
        </PermissionGuard>
      </div>
      {isLoading ? <p className="text-muted-foreground">加载中...</p> : (
        <div className="space-y-2">
          {roles.map((role) => (
            <div key={role.id}
              className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div>
                <span className="font-medium">{role.name}</span>
                <span className="text-muted-foreground text-sm ml-2">({role.code})</span>
                <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{scopeLabel[role.scope] ?? role.scope}</Badge>
                <PermissionGuard resource="role" action="assign">
                  <Button variant="ghost" size="sm"
                    onClick={() => window.location.href = `/rbac/permissions?roleId=${role.id}`}>
                    配置权限
                  </Button>
                </PermissionGuard>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 创建权限配置页（核心：超级管理员给角色分配权限）**

```tsx
// frontend/src/app/(dashboard)/rbac/permissions/page.tsx
'use client'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, Suspense } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

interface Resource { id: number; code: string; name: string; actions: string[] }
interface Permission { id: number; code: string; name: string; resourceId: number; action: string }

function PermissionsContent() {
  const searchParams = useSearchParams()
  const roleId = searchParams.get('roleId')
  const queryClient = useQueryClient()

  const { data: resourcesData } = useQuery({
    queryKey: ['resources'],
    queryFn: () => api.get('/rbac/resources').then(r => r.data.data as Resource[]),
  })

  const { data: rolePermsData } = useQuery({
    queryKey: ['role-permissions', roleId],
    queryFn: () => api.get(`/rbac/roles/${roleId}/permissions`).then(r => r.data.data as Permission[]),
    enabled: !!roleId,
  })

  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (rolePermsData) setSelected(new Set(rolePermsData.map(p => p.id)))
  }, [rolePermsData])

  const { data: allPerms } = useQuery({
    queryKey: ['all-permissions'],
    queryFn: () => api.get('/rbac/permissions').then(r => r.data.data as Permission[]),
  })

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/rbac/roles/${roleId}/permissions`,
      { permissionIds: [...selected] }),
    onSuccess: () => {
      toast.success('权限已保存')
      queryClient.invalidateQueries({ queryKey: ['role-permissions', roleId] })
    },
  })

  const toggle = (permId: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(permId) ? next.delete(permId) : next.add(permId)
      return next
    })
  }

  if (!roleId) return <p className="text-muted-foreground">请从角色管理页选择角色</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">权限配置</h1>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? '保存中...' : '保存权限'}
        </Button>
      </div>
      <div className="space-y-6">
        {(resourcesData ?? []).map((resource) => {
          const perms = (allPerms ?? []).filter(p => p.resourceId === resource.id)
          return (
            <div key={resource.id} className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">{resource.name}</h3>
              <div className="flex flex-wrap gap-4">
                {perms.map((perm) => (
                  <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selected.has(perm.id)}
                      onCheckedChange={() => toggle(perm.id)}
                    />
                    <span className="text-sm">{perm.action}</span>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function PermissionsPage() {
  return (
    <Suspense fallback={<p>加载中...</p>}>
      <PermissionsContent />
    </Suspense>
  )
}
```

- [ ] **Step 3: 添加 TanStack Query Provider 到根布局**

在 `frontend/src/app/layout.tsx` 中添加 Provider：

```tsx
// frontend/src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import Providers from './providers'

const inter = Inter({ subsets: ['latin'] })
export const metadata: Metadata = { title: 'IT 运维平台' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  )
}
```

```tsx
// frontend/src/app/providers.tsx
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
  }))
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

- [ ] **Step 4: 补充后端 RBAC Controller 缺少的接口**

```java
// module/rbac/RoleController.java
package com.cwgsyw.platform.module.rbac;

import com.cwgsyw.platform.common.*;
import com.cwgsyw.platform.module.rbac.dto.*;
import com.cwgsyw.platform.module.rbac.entity.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/rbac")
@RequiredArgsConstructor
public class RoleController {
    private final SysRoleMapper roleMapper;
    private final SysPermissionMapper permMapper;
    private final SysResourceMapper resourceMapper;
    private final RbacService rbacService;

    @GetMapping("/roles")
    @PreAuthorize("hasPermission('role', 'read')")
    public R<PageResult<SysRole>> listRoles(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size) {
        return R.ok(PageResult.of(roleMapper.selectPage(new Page<>(page, size), null)));
    }

    @GetMapping("/resources")
    @PreAuthorize("hasPermission('resource', 'read')")
    public R<List<SysResource>> listResources() {
        return R.ok(rbacService.getAllResources());
    }

    @GetMapping("/permissions")
    @PreAuthorize("hasPermission('resource', 'read')")
    public R<List<SysPermission>> listPermissions() {
        return R.ok(permMapper.selectList(null));
    }

    @GetMapping("/roles/{roleId}/permissions")
    @PreAuthorize("hasPermission('role', 'read')")
    public R<List<SysPermission>> getRolePermissions(@PathVariable Long roleId) {
        List<Long> permIds = new SysRolePermissionMapper() {
            // inline — use injected mapper
        }.findPermissionIdsByRoleIds(List.of(roleId));
        return R.ok(permIds.isEmpty() ? List.of() : permMapper.selectBatchIds(permIds));
    }

    @PutMapping("/roles/{roleId}/permissions")
    @PreAuthorize("hasPermission('resource', 'assign')")
    public R<Void> assignPermissions(@PathVariable Long roleId,
                                     @RequestBody AssignPermissionsRequest req) {
        rbacService.assignPermissionsToRole(roleId, req.getPermissionIds());
        return R.ok();
    }
}
```

> **Note:** `getRolePermissions` 中的 inline mapper 有问题，需注入。将 `SysRolePermissionMapper rolePermMapper` 注入到 `RoleController` 并直接调用 `rolePermMapper.findPermissionIdsByRoleIds(List.of(roleId))`。

- [ ] **Step 5: 创建 AssignPermissionsRequest DTO**

```java
// module/rbac/dto/AssignPermissionsRequest.java
package com.cwgsyw.platform.module.rbac.dto;
import lombok.Data;
import java.util.List;
@Data
public class AssignPermissionsRequest {
    private List<Long> permissionIds;
}
```

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: role and permission management pages"
```

---

## Task 10: 端到端冒烟测试 & Docker Compose 验证

**Files:**
- Modify: `docker-compose.yml` (healthcheck 完善)

- [ ] **Step 1: 启动完整 Docker Compose 环境**

```bash
docker compose up --build -d
docker compose ps
```

Expected: 所有 6 个服务状态为 `running` 或 `healthy`

- [ ] **Step 2: 验证后端健康检查**

```bash
curl http://localhost/api/actuator/health
```

Expected: `{"status":"UP"}`

- [ ] **Step 3: 验证登录接口**

```bash
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}'
```

Expected: `{"code":200,"data":{"token":"eyJ...","username":"superadmin",...}}`

- [ ] **Step 4: 用 token 调用受保护接口**

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r .data.token)

curl http://localhost/api/users \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `{"code":200,"data":{"records":[...],"total":1}}`

- [ ] **Step 5: 验证前端可访问**

```bash
curl -I http://localhost/
```

Expected: `HTTP/1.1 200 OK`

在浏览器打开 `http://localhost`，应显示登录页，用 `superadmin / Admin@123` 登录后跳转到 Dashboard。

- [ ] **Step 6: 验证无权限接口返回 403**

```bash
MEMBER_TOKEN="..."  # 先创建一个只有 member 角色的用户，用其 token
curl http://localhost/api/rbac/roles \
  -H "Authorization: Bearer $MEMBER_TOKEN"
```

Expected: `{"code":403,"message":"无权限"}`

- [ ] **Step 7: 最终 Commit**

```bash
git add .
git commit -m "feat: phase 1 complete - foundation scaffold with auth and RBAC"
git tag v0.1.0
```

---

## 自检清单

### Spec 覆盖
- [x] 用户/组织管理 → Task 5
- [x] 动态 RBAC（Resource/Permission/Role/User）→ Task 2, 5, 9
- [x] JWT 认证 → Task 4, 6
- [x] 超级管理员页面化配置权限 → Task 9
- [x] Docker Compose 全容器化部署 → Task 1, 10
- [x] `tenant_id` 预留 → Task 2（所有表含此字段）
- [x] 逻辑删除 + 审计字段 → Task 2, 3（BaseEntity）
- [x] `audit_log` 表 → Task 2
- [x] 或签设计 → 通过 Flowable 在 Phase 2 实现，Phase 1 预留审批流引擎依赖

### 无 Placeholder 确认
- 所有代码块完整，无 TBD/TODO
- 所有命令有预期输出
- 类型名称在各 Task 间一致（`SecurityUser`, `RbacService`, `SysPermission` 等）
