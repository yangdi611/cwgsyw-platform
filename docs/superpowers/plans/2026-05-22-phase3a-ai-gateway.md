# Phase 3a: AI Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a unified AI gateway that adapts Kimi / DeepSeek / GLM behind one internal API, with encrypted key storage, admin configuration UI, and per-call logging.

**Architecture:** A dedicated `ai_provider_config` table holds one row per provider (seeded for all 3); API keys are encrypted with the existing AES-256-GCM `CryptoService`. `AiGatewayService` picks the first enabled provider, makes an OpenAI-compatible `/chat/completions` call via Spring `RestClient`, and writes to `ai_call_log`. Phase 3b (change documents) will call `AiGatewayService.generate()` directly.

**Tech Stack:** Spring RestClient (Spring Boot 3.4.5 built-in), existing CryptoService, MyBatis-Plus, Next.js 15, shadcn/ui, TanStack Query v5

---

## File Map

**Backend — new:**
- `backend/src/main/resources/db/migration/V8__create_ai_tables.sql`
- `backend/src/main/java/com/cwgsyw/platform/module/ai/entity/AiProviderConfig.java`
- `backend/src/main/java/com/cwgsyw/platform/module/ai/AiProviderConfigMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/ai/entity/AiCallLog.java`
- `backend/src/main/java/com/cwgsyw/platform/module/ai/AiCallLogMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/ai/dto/AiProviderConfigVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/ai/dto/SaveAiProviderConfigRequest.java`
- `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/ai/AiConfigController.java`

**Frontend — new:**
- `frontend/src/app/(dashboard)/admin/ai/page.tsx`

**Frontend — modified:**
- `frontend/src/components/layout/Sidebar.tsx` — add AI config nav item

---

## Task 1: Database Migration V8

**Files:**
- Create: `backend/src/main/resources/db/migration/V8__create_ai_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- V8: AI 网关配置 + 调用日志

CREATE TABLE ai_provider_config (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    provider        VARCHAR(32) NOT NULL,
    api_key_enc     TEXT NOT NULL DEFAULT '',
    base_url        VARCHAR(255) NOT NULL,
    model           VARCHAR(128) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    system_prompt   TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider)
);

INSERT INTO ai_provider_config (tenant_id, provider, api_key_enc, base_url, model, enabled, system_prompt) VALUES
('default', 'kimi',     '', 'https://api.moonshot.cn/v1',           'moonshot-v1-8k', false,
 '你是一个专业的IT运维工程师助手，帮助用户撰写变更文档。请用中文回答，内容专业、简洁。'),
('default', 'deepseek', '', 'https://api.deepseek.com/v1',          'deepseek-chat',  false,
 '你是一个专业的IT运维工程师助手，帮助用户撰写变更文档。请用中文回答，内容专业、简洁。'),
('default', 'glm',      '', 'https://open.bigmodel.cn/api/paas/v4', 'glm-4-flash',    false,
 '你是一个专业的IT运维工程师助手，帮助用户撰写变更文档。请用中文回答，内容专业、简洁。');

CREATE TABLE ai_call_log (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL DEFAULT 'default',
    provider            VARCHAR(32) NOT NULL,
    model               VARCHAR(128),
    prompt_tokens       INTEGER DEFAULT 0,
    completion_tokens   INTEGER DEFAULT 0,
    duration_ms         INTEGER DEFAULT 0,
    success             BOOLEAN NOT NULL DEFAULT TRUE,
    error_msg           TEXT,
    ref_type            VARCHAR(64),
    ref_id              BIGINT,
    operator_id         BIGINT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_call_log_tenant ON ai_call_log(tenant_id, created_at DESC);
CREATE INDEX idx_ai_call_log_operator ON ai_call_log(operator_id, created_at DESC);

-- RBAC
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('ai_config', 'AI网关配置', '["read","write"]', 95);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'ai_config';

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'ai_config:%'
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Rebuild backend to apply migration**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -5
docker compose up -d backend
sleep 20
docker compose logs backend --tail=20
```

Expected: `Successfully applied 1 migration to schema "public", now at version v8`

- [ ] **Step 3: Verify**

```bash
docker compose exec postgres psql -U platform_user -d cwgsyw_platform \
  -c "SELECT provider, base_url, model, enabled FROM ai_provider_config;" \
  -c "SELECT r.code, p.code FROM sys_role r JOIN sys_role_permission rp ON r.id=rp.role_id JOIN sys_permission p ON p.id=rp.permission_id WHERE p.code LIKE 'ai_config:%' ORDER BY r.code, p.code;"
```

Expected: 3 rows in `ai_provider_config` (all enabled=false), `ai_config:read` and `ai_config:write` on super_admin and admin.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/resources/db/migration/V8__create_ai_tables.sql
git commit -m "feat: V8 migration - ai_provider_config and ai_call_log tables"
```

---

## Task 2: Entities and Mappers

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/ai/entity/AiProviderConfig.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/ai/AiProviderConfigMapper.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/ai/entity/AiCallLog.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/ai/AiCallLogMapper.java`

- [ ] **Step 1: Create AiProviderConfig entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/ai/entity/AiProviderConfig.java
package com.cwgsyw.platform.module.ai.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ai_provider_config")
public class AiProviderConfig {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String provider;
    private String apiKeyEnc;
    private String baseUrl;
    private String model;
    private Boolean enabled;
    private String systemPrompt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 2: Create AiProviderConfigMapper**

```java
// backend/src/main/java/com/cwgsyw/platform/module/ai/AiProviderConfigMapper.java
package com.cwgsyw.platform.module.ai;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.ai.entity.AiProviderConfig;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface AiProviderConfigMapper extends BaseMapper<AiProviderConfig> {
    @Select("SELECT * FROM ai_provider_config WHERE tenant_id = #{tenantId} ORDER BY provider")
    List<AiProviderConfig> findByTenant(@Param("tenantId") String tenantId);

    @Select("SELECT * FROM ai_provider_config WHERE tenant_id = #{tenantId} AND provider = #{provider}")
    AiProviderConfig findByTenantAndProvider(@Param("tenantId") String tenantId, @Param("provider") String provider);
}
```

- [ ] **Step 3: Create AiCallLog entity**

```java
// backend/src/main/java/com/cwgsyw/platform/module/ai/entity/AiCallLog.java
package com.cwgsyw.platform.module.ai.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("ai_call_log")
public class AiCallLog {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String tenantId;
    private String provider;
    private String model;
    private Integer promptTokens;
    private Integer completionTokens;
    private Integer durationMs;
    private Boolean success;
    private String errorMsg;
    private String refType;
    private Long refId;
    private Long operatorId;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 4: Create AiCallLogMapper**

```java
// backend/src/main/java/com/cwgsyw/platform/module/ai/AiCallLogMapper.java
package com.cwgsyw.platform.module.ai;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.ai.entity.AiCallLog;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface AiCallLogMapper extends BaseMapper<AiCallLog> {
}
```

- [ ] **Step 5: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend && ./mvnw compile -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/ai/
git commit -m "feat: AiProviderConfig and AiCallLog entities and mappers"
```

---

## Task 3: AiGatewayService

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/ai/dto/AiProviderConfigVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/ai/dto/SaveAiProviderConfigRequest.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java`

- [ ] **Step 1: Create AiProviderConfigVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/ai/dto/AiProviderConfigVO.java
package com.cwgsyw.platform.module.ai.dto;

import lombok.Data;

@Data
public class AiProviderConfigVO {
    private String provider;
    private String providerLabel;
    private String baseUrl;
    private String model;
    private Boolean enabled;
    private String systemPrompt;
    private boolean configured;
}
```

- [ ] **Step 2: Create SaveAiProviderConfigRequest**

```java
// backend/src/main/java/com/cwgsyw/platform/module/ai/dto/SaveAiProviderConfigRequest.java
package com.cwgsyw.platform.module.ai.dto;

import lombok.Data;

@Data
public class SaveAiProviderConfigRequest {
    private String apiKey;
    private String baseUrl;
    private String model;
    private Boolean enabled;
    private String systemPrompt;
}
```

- [ ] **Step 3: Create AiGatewayService**

```java
// backend/src/main/java/com/cwgsyw/platform/module/ai/AiGatewayService.java
package com.cwgsyw.platform.module.ai;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.cwgsyw.platform.config.CryptoService;
import com.cwgsyw.platform.module.ai.dto.AiProviderConfigVO;
import com.cwgsyw.platform.module.ai.dto.SaveAiProviderConfigRequest;
import com.cwgsyw.platform.module.ai.entity.AiCallLog;
import com.cwgsyw.platform.module.ai.entity.AiProviderConfig;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiGatewayService {
    private final AiProviderConfigMapper configMapper;
    private final AiCallLogMapper callLogMapper;
    private final CryptoService cryptoService;

    private static final Map<String, String> PROVIDER_LABELS = Map.of(
        "kimi",     "Kimi（月之暗面）",
        "deepseek", "DeepSeek",
        "glm",      "智谱 GLM"
    );

    /** Called by Phase 3b (change documents) to generate AI content. */
    public String generate(String tenantId, String userPrompt, String refType, Long refId, Long operatorId) {
        AiProviderConfig config = configMapper.selectOne(
            new LambdaQueryWrapper<AiProviderConfig>()
                .eq(AiProviderConfig::getTenantId, tenantId)
                .eq(AiProviderConfig::getEnabled, true)
                .orderByAsc(AiProviderConfig::getProvider)
                .last("LIMIT 1"));
        if (config == null) {
            throw new IllegalStateException("未配置可用的 AI 服务，请联系管理员在系统配置中启用 AI 提供商");
        }
        return callWithLogging(config, userPrompt, refType, refId, operatorId);
    }

    /** Called by AiConfigController to test a specific provider. */
    public String testProvider(String tenantId, String provider) {
        AiProviderConfig config = configMapper.findByTenantAndProvider(tenantId, provider);
        if (config == null || config.getApiKeyEnc() == null || config.getApiKeyEnc().isBlank()) {
            throw new IllegalStateException("该 AI 服务未配置 API Key");
        }
        return callWithLogging(config, "请用一句话介绍你自己", "test", null, null);
    }

    /** Called by AiConfigController to save/update a provider config. */
    public void saveProviderConfig(String tenantId, String provider, SaveAiProviderConfigRequest req) {
        AiProviderConfig existing = configMapper.findByTenantAndProvider(tenantId, provider);
        if (existing == null) {
            throw new IllegalStateException("Provider not found: " + provider);
        }
        LambdaUpdateWrapper<AiProviderConfig> update = new LambdaUpdateWrapper<AiProviderConfig>()
            .eq(AiProviderConfig::getTenantId, tenantId)
            .eq(AiProviderConfig::getProvider, provider)
            .set(AiProviderConfig::getUpdatedAt, LocalDateTime.now());
        if (req.getApiKey() != null && !req.getApiKey().isBlank() && !req.getApiKey().startsWith("••")) {
            update.set(AiProviderConfig::getApiKeyEnc, cryptoService.encrypt(req.getApiKey()));
        }
        if (req.getBaseUrl() != null)     update.set(AiProviderConfig::getBaseUrl, req.getBaseUrl());
        if (req.getModel() != null)       update.set(AiProviderConfig::getModel, req.getModel());
        if (req.getEnabled() != null)     update.set(AiProviderConfig::getEnabled, req.getEnabled());
        if (req.getSystemPrompt() != null) update.set(AiProviderConfig::getSystemPrompt, req.getSystemPrompt());
        configMapper.update(null, update);
    }

    /** Returns VO list for all providers, API keys masked. */
    public List<AiProviderConfigVO> listProviders(String tenantId) {
        List<AiProviderConfig> configs = configMapper.findByTenant(tenantId);
        List<AiProviderConfigVO> result = new ArrayList<>();
        for (AiProviderConfig c : configs) {
            AiProviderConfigVO vo = new AiProviderConfigVO();
            vo.setProvider(c.getProvider());
            vo.setProviderLabel(PROVIDER_LABELS.getOrDefault(c.getProvider(), c.getProvider()));
            vo.setBaseUrl(c.getBaseUrl());
            vo.setModel(c.getModel());
            vo.setEnabled(c.getEnabled());
            vo.setSystemPrompt(c.getSystemPrompt());
            vo.setConfigured(c.getApiKeyEnc() != null && !c.getApiKeyEnc().isBlank());
            result.add(vo);
        }
        return result;
    }

    private String callWithLogging(AiProviderConfig config, String userPrompt,
                                    String refType, Long refId, Long operatorId) {
        long start = System.currentTimeMillis();
        boolean success = true;
        String errorMsg = null;
        int promptTokens = 0, completionTokens = 0;
        String result = null;
        try {
            String apiKey = cryptoService.decrypt(config.getApiKeyEnc());
            ChatResponse resp = callProvider(config, apiKey, userPrompt);
            result = resp.getChoices().get(0).getMessage().getContent();
            if (resp.getUsage() != null) {
                promptTokens   = resp.getUsage().getPromptTokens();
                completionTokens = resp.getUsage().getCompletionTokens();
            }
        } catch (Exception e) {
            success = false;
            errorMsg = e.getMessage();
            log.error("AI call failed provider={}: {}", config.getProvider(), e.getMessage());
            throw new RuntimeException("AI 生成失败: " + e.getMessage(), e);
        } finally {
            AiCallLog callLog = new AiCallLog();
            callLog.setTenantId(config.getTenantId());
            callLog.setProvider(config.getProvider());
            callLog.setModel(config.getModel());
            callLog.setPromptTokens(promptTokens);
            callLog.setCompletionTokens(completionTokens);
            callLog.setDurationMs((int)(System.currentTimeMillis() - start));
            callLog.setSuccess(success);
            callLog.setErrorMsg(errorMsg);
            callLog.setRefType(refType);
            callLog.setRefId(refId);
            callLog.setOperatorId(operatorId);
            callLog.setCreatedAt(LocalDateTime.now());
            callLogMapper.insert(callLog);
        }
        return result;
    }

    private ChatResponse callProvider(AiProviderConfig config, String apiKey, String userPrompt) {
        List<ChatMessage> messages = new ArrayList<>();
        if (config.getSystemPrompt() != null && !config.getSystemPrompt().isBlank()) {
            messages.add(new ChatMessage("system", config.getSystemPrompt()));
        }
        messages.add(new ChatMessage("user", userPrompt));

        ChatRequest req = new ChatRequest(config.getModel(), messages, 0.7);

        return RestClient.create()
            .post()
            .uri(config.getBaseUrl() + "/chat/completions")
            .header("Authorization", "Bearer " + apiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .body(req)
            .retrieve()
            .body(ChatResponse.class);
    }

    // ── Inner DTOs for OpenAI-compatible API ──────────────────────────────────

    @Data @AllArgsConstructor @NoArgsConstructor
    static class ChatRequest {
        private String model;
        private List<ChatMessage> messages;
        private double temperature;
    }

    @Data @AllArgsConstructor @NoArgsConstructor
    static class ChatMessage {
        private String role;
        private String content;
    }

    @Data
    static class ChatResponse {
        private List<ChatChoice> choices;
        private ChatUsage usage;
    }

    @Data
    static class ChatChoice {
        private ChatMessage message;
    }

    @Data
    static class ChatUsage {
        @JsonProperty("prompt_tokens")
        private int promptTokens;
        @JsonProperty("completion_tokens")
        private int completionTokens;
    }
}
```

- [ ] **Step 4: Compile check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/backend && ./mvnw compile -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/ai/
git commit -m "feat: AiGatewayService with OpenAI-compatible provider adapter"
```

---

## Task 4: AiConfigController

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/ai/AiConfigController.java`

- [ ] **Step 1: Create AiConfigController**

```java
// backend/src/main/java/com/cwgsyw/platform/module/ai/AiConfigController.java
package com.cwgsyw.platform.module.ai;

import com.cwgsyw.platform.common.R;
import com.cwgsyw.platform.module.ai.dto.AiProviderConfigVO;
import com.cwgsyw.platform.module.ai.dto.SaveAiProviderConfigRequest;
import com.cwgsyw.platform.security.SecurityUser;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/admin/ai")
@RequiredArgsConstructor
public class AiConfigController {
    private final AiGatewayService aiGatewayService;

    @GetMapping("/providers")
    @PreAuthorize("hasAuthority('ai_config:read')")
    public R<List<AiProviderConfigVO>> listProviders(@AuthenticationPrincipal SecurityUser user) {
        return R.ok(aiGatewayService.listProviders(user.getTenantId()));
    }

    @PutMapping("/providers/{provider}")
    @PreAuthorize("hasAuthority('ai_config:write')")
    public R<Void> saveProvider(@PathVariable String provider,
                                 @RequestBody SaveAiProviderConfigRequest req,
                                 @AuthenticationPrincipal SecurityUser user) {
        aiGatewayService.saveProviderConfig(user.getTenantId(), provider, req);
        return R.ok(null);
    }

    @PostMapping("/providers/{provider}/test")
    @PreAuthorize("hasAuthority('ai_config:write')")
    public R<String> testProvider(@PathVariable String provider,
                                   @AuthenticationPrincipal SecurityUser user) {
        String reply = aiGatewayService.testProvider(user.getTenantId(), provider);
        return R.ok(reply);
    }
}
```

- [ ] **Step 2: Rebuild and restart backend**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -5
docker compose up -d backend
sleep 20
docker compose logs backend --tail=15
```

Expected: Started successfully, no errors.

- [ ] **Step 3: Smoke test the API**

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/admin/ai/providers | jq .
```

Expected: 3 providers (kimi, deepseek, glm), all enabled=false, configured=false.

- [ ] **Step 4: Commit**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/ai/AiConfigController.java
git commit -m "feat: AiConfigController admin endpoints for AI provider management"
```

---

## Task 5: Frontend Admin AI Config Page

**Files:**
- Create: `frontend/src/app/(dashboard)/admin/ai/page.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create the admin AI config page**

```tsx
// frontend/src/app/(dashboard)/admin/ai/page.tsx
'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/usePermission'
import { useRouter } from 'next/navigation'

interface ProviderVO {
  provider: string
  provider_label: string
  base_url: string
  model: string
  enabled: boolean
  system_prompt: string
  configured: boolean
}

type FormState = {
  api_key: string
  base_url: string
  model: string
  enabled: boolean
  system_prompt: string
}

function ProviderCard({ p, onRefresh }: { p: ProviderVO; onRefresh: () => void }) {
  const [form, setForm] = useState<FormState>({
    api_key: '',
    base_url: p.base_url,
    model: p.model,
    enabled: p.enabled,
    system_prompt: p.system_prompt ?? '',
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    setForm({
      api_key: '',
      base_url: p.base_url,
      model: p.model,
      enabled: p.enabled,
      system_prompt: p.system_prompt ?? '',
    })
    setTestResult(null)
  }, [p])

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/admin/ai/providers/${p.provider}`, {
      api_key: form.api_key || undefined,
      base_url: form.base_url,
      model: form.model,
      enabled: form.enabled,
      system_prompt: form.system_prompt,
    }),
    onSuccess: () => { toast.success(`${p.provider_label} 配置已保存`); onRefresh() },
    onError: () => toast.error('保存失败'),
  })

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await api.post(`/admin/ai/providers/${p.provider}/test`)
      setTestResult(res.data.data)
      toast.success('连接测试成功')
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      setTestResult(null)
      toast.error(err?.response?.data?.message ?? '连接测试失败')
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{p.provider_label}</h2>
          {p.configured
            ? <Badge variant="outline" className="text-green-600 border-green-300">已配置</Badge>
            : <Badge variant="secondary">未配置</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id={`${p.provider}-enabled`}
            checked={form.enabled}
            onCheckedChange={v => setForm(f => ({ ...f, enabled: v }))}
          />
          <Label htmlFor={`${p.provider}-enabled`}>启用</Label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>API Key</Label>
          <Input
            type="password"
            value={form.api_key}
            onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
            placeholder={p.configured ? '留空保留现有 Key' : '输入 API Key'}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Base URL</Label>
            <Input value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Input value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>System Prompt</Label>
          <Textarea
            value={form.system_prompt}
            onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
            rows={3}
          />
        </div>

        {testResult && (
          <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
            <span className="font-medium text-foreground">AI 回复：</span>{testResult}
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            保存配置
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing || !p.configured}>
            {testing ? '测试中...' : '测试连接'}
          </Button>
        </div>
      </div>
    </section>
  )
}

export default function AdminAiPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!hasPermission('ai_config', 'read')) router.replace('/')
  }, [hasPermission, router])

  const { data: providers = [] } = useQuery<ProviderVO[]>({
    queryKey: ['admin-ai-providers'],
    queryFn: () => api.get('/admin/ai/providers').then(r => r.data.data),
    enabled: hasPermission('ai_config', 'read'),
  })

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">AI 网关配置</h1>
      <p className="text-sm text-muted-foreground mb-6">配置 AI 服务提供商，用于变更文档智能生成。启用后将使用第一个已启用的提供商。</p>
      <div className="space-y-6">
        {providers.map(p => (
          <ProviderCard
            key={p.provider}
            p={p}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['admin-ai-providers'] })}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add AI config nav item to Sidebar**

In `frontend/src/components/layout/Sidebar.tsx`, add `Brain` to the lucide-react imports, then add this entry to `navItems` after `系统配置`:

```tsx
import { ..., Brain } from 'lucide-react'

// In navItems array, after { href: '/admin/config', ... }:
{ href: '/admin/ai', label: 'AI 网关', icon: Brain, resource: 'ai_config', action: 'read' },
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | tail -15
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/app/(dashboard)/admin/ai/page.tsx" \
        frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: admin AI provider config page with test connection"
```

---

## Task 6: Integration Test + Final Build

- [ ] **Step 1: Rebuild frontend**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build frontend 2>&1 | tail -5
docker compose up -d frontend
sleep 15
docker compose ps
```

Expected: all 6 containers healthy.

- [ ] **Step 2: Verify GET /api/admin/ai/providers**

```bash
TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | jq -r '.data.token')

curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/admin/ai/providers | jq '.data[] | {provider, enabled, configured}'
```

Expected:
```json
{"provider":"deepseek","enabled":false,"configured":false}
{"provider":"glm","enabled":false,"configured":false}
{"provider":"kimi","enabled":false,"configured":false}
```

- [ ] **Step 3: Verify PUT /api/admin/ai/providers/kimi saves config (without real key)**

```bash
curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  http://localhost/api/admin/ai/providers/kimi \
  -d '{"base_url":"https://api.moonshot.cn/v1","model":"moonshot-v1-8k","enabled":false,"system_prompt":"test prompt"}' | jq .

curl -s -H "Authorization: Bearer $TOKEN" http://localhost/api/admin/ai/providers | jq '.data[] | select(.provider=="kimi") | {model, system_prompt}'
```

Expected: `{"model":"moonshot-v1-8k","system_prompt":"test prompt"}`

- [ ] **Step 4: Verify RBAC — member cannot access**

```bash
MEMBER_TOKEN=$(curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"zhangsan","password":"Admin@123"}' | jq -r '.data.token // empty')

if [ -n "$MEMBER_TOKEN" ]; then
  curl -s -H "Authorization: Bearer $MEMBER_TOKEN" http://localhost/api/admin/ai/providers | jq .code
fi
```

Expected: `403` (if member user exists) or skip if no member user is configured.

- [ ] **Step 5: Tag release**

```bash
git tag v0.3.1-ai-gateway
echo "Tagged v0.3.1-ai-gateway"
```

- [ ] **Step 6: Final commit if any loose changes**

```bash
git status
```

If clean, no commit needed.

---

## RBAC Checklist

- [x] `ai_config` resource in V8 migration with actions `read` and `write`
- [x] Only `super_admin` and `admin` get `ai_config:read` and `ai_config:write`
- [x] All controller endpoints have `@PreAuthorize`
- [x] Frontend page redirects if no `ai_config:read` permission
- [x] Sidebar nav item gated by `ai_config:read`

## Self-Review

### Spec coverage
- ✅ Kimi, DeepSeek, GLM supported
- ✅ API Key encrypted storage (CryptoService)
- ✅ Admin page: enable/disable, API Key, base URL, model, system prompt
- ✅ API Key not returned to frontend (VO only has `configured: boolean`)
- ✅ Call logging (ai_call_log table)
- ✅ `AiGatewayService.generate()` ready for Phase 3b consumption

### No placeholders found.

### Type consistency
- `AiProviderConfigVO.configured` (boolean) — used in frontend `p.configured`
- `SaveAiProviderConfigRequest.apiKey` → Jackson snake_case → `api_key` in JSON ✅
- `AiGatewayService.generate(tenantId, userPrompt, refType, refId, operatorId)` — consistent throughout
