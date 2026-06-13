# CMDB Tier 4 集成联动 — 实施计划

**日期：** 2026-06-13  
**基于：** specs/2026-06-13-cmdb-tier4-spec.md  
**预估工作量：** 11-18 天  
**实施顺序：** 4A → 4B → 4C → 4D → 4E → 4F（按 spec 建议）

---

## Phase 4A: CMDB ↔ 通知中心（1-2 天）

### Task 1: CI 实例状态变更通知
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/service/CiInstanceService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/service/CiNotificationService.java` (新增)

**Step 1:** 在 `module/cmdb/service/` 创建 `CiNotificationService.java`
```java
@Service
@RequiredArgsConstructor
public class CiNotificationService {
    private final NotificationService notificationService;
    private final CiInstanceMapper ciInstanceMapper;
    private final UserMapper userMapper;

    public void notifyStatusChange(CiInstance instance, String oldStatus, String newStatus, Long operatorId) {
        if (oldStatus.equals(newStatus)) return;
        
        List<Long> notifyUserIds = resolveNotifyTargets(instance, operatorId);
        for (Long uid : notifyUserIds) {
            notificationService.notify(
                instance.getTenantId(),
                uid,
                "CI 状态变更: " + instance.getName(),
                String.format("CI 实例 [%s] 状态从 %s 变为 %s", instance.getName(), oldStatus, newStatus),
                "system",
                "ci_instance",
                instance.getId()
            );
        }
    }

    private List<Long> resolveNotifyTargets(CiInstance instance, Long operatorId) {
        List<Long> targets = new ArrayList<>();
        // 1. Owner
        if (instance.getOwner() != null) {
            User owner = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, instance.getOwner()));
            if (owner != null) targets.add(owner.getId());
        }
        // 2. 管理员（groupScope=platform 或 tenant）
        List<User> admins = userMapper.selectList(new LambdaQueryWrapper<User>()
            .eq(User::getTenantId, instance.getTenantId())
            .eq(User::getIsDeleted, false));
        admins.stream()
            .filter(u -> "platform".equals(u.getGroupScope()) || "tenant".equals(u.getGroupScope()))
            .map(User::getId)
            .forEach(targets::add);
        // 去重并排除操作人
        return targets.stream().distinct().filter(id -> !id.equals(operatorId)).collect(Collectors.toList());
    }
}
```

**Step 2:** 修改 `CiInstanceService.updateStatus()` 方法，在 save 后调用通知
```java
@Transactional
public void updateStatus(Long id, String newStatus, String tenantId, Long operatorId) {
    CiInstance inst = loadInstance(id, tenantId);
    String oldStatus = inst.getStatus();
    inst.setStatus(newStatus);
    inst.setUpdatedAt(LocalDateTime.now());
    inst.setUpdatedBy(operatorId);
    ciInstanceMapper.updateById(inst);
    
    // 审计日志
    writeAuditLog(tenantId, "cmdb", "update_status", id, "ci_instance", operatorId, 
        Map.of("oldStatus", oldStatus), Map.of("newStatus", newStatus));
    
    // 发通知
    ciNotificationService.notifyStatusChange(inst, oldStatus, newStatus, operatorId);
}
```

**Step 3:** 在 `CiInstanceService` 构造函数注入 `CiNotificationService`

**Step 4:** 验证：更新一个 CI 实例状态，检查 notification_message 表是否写入记录

---

### Task 2: CI 实例删除通知
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/service/CiInstanceService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/service/CiNotificationService.java`

**Step 1:** 在 `CiNotificationService` 添加 `notifyDelete()` 方法
```java
public void notifyDelete(CiInstance instance, Long operatorId) {
    String operatorName = "系统";
    if (operatorId != null && operatorId > 0) {
        User operator = userMapper.selectById(operatorId);
        if (operator != null) operatorName = operator.getUsername();
    }
    
    List<Long> notifyUserIds = resolveNotifyTargets(instance, operatorId);
    for (Long uid : notifyUserIds) {
        notificationService.notify(
            instance.getTenantId(),
            uid,
            "CI 实例已删除: " + instance.getName(),
            String.format("CI 实例 [%s] 已被 %s 删除", instance.getName(), operatorName),
            "system",
            "ci_instance",
            instance.getId()
        );
    }
}
```

**Step 2:** 修改 `CiInstanceService.delete()` 方法，在软删除后调用通知
```java
@Transactional
public void delete(Long id, String tenantId, Long operatorId) {
    CiInstance inst = loadInstance(id, tenantId);
    inst.setIsDeleted(true);
    inst.setDeletedAt(LocalDateTime.now());
    inst.setDeletedBy(operatorId);
    ciInstanceMapper.updateById(inst);
    
    // 审计日志
    writeAuditLog(tenantId, "cmdb", "delete", id, "ci_instance", operatorId, 
        Map.of("name", inst.getName()), Map.of());
    
    // 发通知
    ciNotificationService.notifyDelete(inst, operatorId);
}
```

**Step 3:** 验证：删除一个 CI 实例，检查通知

---

### Task 3: 前端通知跳转
**Files:**
- `frontend/src/app/(dashboard)/notifications/page.tsx`
- `frontend/src/components/notification/NotificationItem.tsx` (新增)

**Step 1:** 创建 `NotificationItem.tsx` 组件
```tsx
import Link from 'next/link';
import { NotificationVO } from '@/types/notification';

export function NotificationItem({ notification }: { notification: NotificationVO }) {
  const getHref = () => {
    if (notification.refType === 'ci_instance') {
      return `/dashboard/cmdb/instances/${notification.refId}`;
    }
    if (notification.refType === 'change_doc') {
      return `/dashboard/change-docs/${notification.refId}`;
    }
    if (notification.refType === 'daily_report') {
      return `/dashboard/daily/${notification.refId}`;
    }
    return null;
  };

  const href = getHref();
  const content = (
    <div className="flex items-start gap-3 p-3 hover:bg-muted rounded-lg">
      <div className="flex-1">
        <div className="font-medium">{notification.title}</div>
        <div className="text-sm text-muted-foreground">{notification.content}</div>
        <div className="text-xs text-muted-foreground mt-1">
          {new Date(notification.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
```

**Step 2:** 在 `notifications/page.tsx` 中使用 `NotificationItem` 替换原有列表项渲染

**Step 3:** 验证：点击 refType=ci_instance 的通知，跳转到实例详情页

---

## Phase 4B: CMDB ↔ 密码库（1-2 天）

### Task 4: 数据库迁移 — device 加列
**Files:**
- `backend/src/main/resources/db/migration/V26__device_add_ci_instance.sql` (新增)

**Step 1:** 创建迁移脚本
```sql
-- V26: device 表关联 CI 实例
ALTER TABLE device ADD COLUMN ci_instance_id BIGINT;
CREATE INDEX idx_device_ci_instance ON device(ci_instance_id) WHERE ci_instance_id IS NOT NULL;
```

**Step 2:** 验证：`docker compose up -d db` → 检查表结构

---

### Task 5: Device 实体加字段
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/device/entity/Device.java`

**Step 1:** 添加字段
```java
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("device")
public class Device extends BaseEntity {
    private Long groupId;
    private String name;
    private String ip;
    private String deviceType;
    private String category;
    private String description;
    private Long ciInstanceId;  // 新增
}
```

**Step 2:** 验证：编译通过

---

### Task 6: Device DTO 加字段
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/device/dto/DeviceVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/device/dto/CreateDeviceRequest.java`

**Step 1:** `DeviceVO` 添加 `ciInstanceId` 和 `ciInstanceName`
```java
public class DeviceVO {
    // ... existing fields
    private Long ciInstanceId;
    private String ciInstanceName;  // 用于展示
}
```

**Step 2:** `CreateDeviceRequest` 添加可选 `ciInstanceId`
```java
public class CreateDeviceRequest {
    // ... existing fields
    private Long ciInstanceId;  // 可选
}
```

**Step 3:** 验证：编译通过

---

### Task 7: DeviceService 支持关联
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/device/DeviceService.java`

**Step 1:** 修改 `create()` 和 `update()` 方法，保存 `ciInstanceId`
```java
@Transactional
public DeviceVO create(CreateDeviceRequest req, String tenantId, Long operatorId) {
    Device device = new Device();
    device.setGroupId(req.getGroupId());
    device.setName(req.getName());
    device.setIp(req.getIp());
    device.setDeviceType(req.getDeviceType());
    device.setCategory(req.getCategory());
    device.setDescription(req.getDescription());
    device.setCiInstanceId(req.getCiInstanceId());  // 新增
    // ... rest of the code
}
```

**Step 2:** 修改 `getById()` 和 `list()` 的 VO 转换，填充 `ciInstanceName`
```java
private DeviceVO toVO(Device device, String tenantId) {
    DeviceVO vo = new DeviceVO();
    // ... existing mapping
    vo.setCiInstanceId(device.getCiInstanceId());
    
    if (device.getCiInstanceId() != null) {
        CiInstance ci = ciInstanceMapper.selectById(device.getCiInstanceId());
        if (ci != null) {
            vo.setCiInstanceName(ci.getName());
        }
    }
    return vo;
}
```

**Step 3:** 在 `DeviceService` 注入 `CiInstanceMapper`

**Step 4:** 验证：创建设备时选择 CI 实例，列表页显示实例名称

---

### Task 8: CMDB 实例详情 — 关联设备 API
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/controller/CiInstanceController.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/service/CiInstanceService.java`

**Step 1:** 在 `CiInstanceService` 添加 `getRelatedDevices()` 方法
```java
public List<DeviceVO> getRelatedDevices(Long instanceId, String tenantId) {
    loadInstance(instanceId, tenantId);  // 验证实例存在
    
    List<Device> devices = deviceMapper.selectList(new LambdaQueryWrapper<Device>()
        .eq(Device::getCiInstanceId, instanceId)
        .eq(Device::getTenantId, tenantId)
        .eq(Device::getIsDeleted, false));
    
    return devices.stream().map(this::toDeviceVO).collect(Collectors.toList());
}

private DeviceVO toDeviceVO(Device device) {
    DeviceVO vo = new DeviceVO();
    vo.setId(device.getId());
    vo.setName(device.getName());
    vo.setIp(device.getIp());
    vo.setDeviceType(device.getDeviceType());
    vo.setCategory(device.getCategory());
    vo.setDescription(device.getDescription());
    return vo;
}
```

**Step 2:** 在 `CiInstanceService` 注入 `DeviceMapper`

**Step 3:** 在 `CiInstanceController` 添加端点
```java
@GetMapping("/{id}/devices")
@PreAuthorize("hasPermission('cmdb_instance', 'read') and hasPermission('device', 'read')")
public R<List<DeviceVO>> getRelatedDevices(@PathVariable Long id,
                                           @AuthenticationPrincipal SecurityUser cu) {
    return R.ok(ciInstanceService.getRelatedDevices(id, cu.getTenantId()));
}
```

**Step 4:** 验证：访问 `/api/cmdb/instances/{id}/devices` 返回关联设备列表

---

### Task 9: 前端 — 设备表单加 CI 选择
**Files:**
- `frontend/src/app/(dashboard)/devices/new/page.tsx`
- `frontend/src/app/(dashboard)/devices/[id]/page.tsx`
- `frontend/src/components/device/DeviceForm.tsx` (新增或修改)

**Step 1:** 添加 CI 实例搜索下拉组件
```tsx
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function CiInstanceSelect({ value, onChange }: { value?: number; onChange: (v: number | null) => void }) {
  const [instances, setInstances] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/cmdb/instances', { params: { keyword: search, page: 1, size: 20 } })
      .then(res => setInstances(res.data.items));
  }, [search]);

  return (
    <Select value={value?.toString()} onValueChange={v => onChange(v ? parseInt(v) : null)}>
      <SelectTrigger>
        <SelectValue placeholder="选择 CI 实例（可选）" />
      </SelectTrigger>
      <SelectContent>
        <input
          type="text"
          placeholder="搜索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full p-2 border-b"
        />
        {instances.map(inst => (
          <SelectItem key={inst.id} value={inst.id.toString()}>
            {inst.name} ({inst.modelName})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

**Step 2:** 在设备创建/编辑表单中集成 `CiInstanceSelect`

**Step 3:** 验证：创建设备时可选择 CI 实例

---

### Task 10: 前端 — 实例详情显示关联设备
**Files:**
- `frontend/src/app/(dashboard)/cmdb/instances/[id]/page.tsx`
- `frontend/src/components/cmdb/RelatedDevicesTab.tsx` (新增)

**Step 1:** 创建 `RelatedDevicesTab.tsx`
```tsx
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function RelatedDevicesTab({ instanceId }: { instanceId: number }) {
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/cmdb/instances/${instanceId}/devices`)
      .then(res => setDevices(res.data))
      .finally(() => setLoading(false));
  }, [instanceId]);

  if (loading) return <div>加载中...</div>;
  if (devices.length === 0) return <div className="text-muted-foreground">暂无关联设备</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>关联设备 ({devices.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>分类</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map(d => (
              <TableRow key={d.id}>
                <TableCell>
                  <a href={`/dashboard/devices/${d.id}`} className="text-primary hover:underline">
                    {d.name}
                  </a>
                </TableCell>
                <TableCell>{d.ip}</TableCell>
                <TableCell>{d.deviceType}</TableCell>
                <TableCell>{d.category}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

**Step 2:** 在实例详情页添加 "设备" tab，渲染 `RelatedDevicesTab`

**Step 3:** 验证：实例详情页显示关联设备列表

---

## Phase 4C: CMDB ↔ 变更文档（2-3 天）

### Task 11: 数据库迁移 — change_doc_ci_link 表
**Files:**
- `backend/src/main/resources/db/migration/V27__change_doc_ci_link.sql` (新增)

**Step 1:** 创建迁移脚本
```sql
-- V27: 变更文档关联 CI 实例
CREATE TABLE change_doc_ci_link (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    change_doc_id   BIGINT NOT NULL REFERENCES change_doc(id),
    instance_id     BIGINT NOT NULL REFERENCES ci_instance(id),
    impact_level    VARCHAR(32) DEFAULT 'normal',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_changedoc_ci ON change_doc_ci_link(change_doc_id, instance_id);
CREATE INDEX idx_ci_changedoc ON change_doc_ci_link(instance_id);
```

**Step 2:** 验证：迁移成功

---

### Task 12: 实体 + Mapper
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/entity/ChangeDocCiLink.java` (新增)
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocCiLinkMapper.java` (新增)

**Step 1:** 创建实体
```java
package com.cwgsyw.platform.module.changedoc.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.cwgsyw.platform.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("change_doc_ci_link")
public class ChangeDocCiLink extends BaseEntity {
    private String tenantId;
    private Long changeDocId;
    private Long instanceId;
    private String impactLevel;  // low / normal / high / critical
}
```

**Step 2:** 创建 Mapper
```java
package com.cwgsyw.platform.module.changedoc;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.cwgsyw.platform.module.changedoc.entity.ChangeDocCiLink;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ChangeDocCiLinkMapper extends BaseMapper<ChangeDocCiLink> {
}
```

**Step 3:** 验证：编译通过

---

### Task 13: 变更文档关联 CI — Service 层
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/dto/LinkCiRequest.java` (新增)

**Step 1:** 创建 DTO
```java
package com.cwgsyw.platform.module.changedoc.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
public class LinkCiRequest {
    @NotEmpty
    private List<CiLinkItem> links;

    @Data
    public static class CiLinkItem {
        @NotNull
        private Long instanceId;
        private String impactLevel = "normal";
    }
}
```

**Step 2:** 在 `ChangeDocService` 添加关联方法
```java
@Transactional
public void linkCiInstances(Long changeDocId, LinkCiRequest req, String tenantId, Long operatorId) {
    ChangeDoc doc = loadChangeDoc(changeDocId, tenantId);
    
    for (LinkCiRequest.CiLinkItem item : req.getLinks()) {
        ChangeDocCiLink link = new ChangeDocCiLink();
        link.setTenantId(tenantId);
        link.setChangeDocId(changeDocId);
        link.setInstanceId(item.getInstanceId());
        link.setImpactLevel(item.getImpactLevel());
        link.setCreatedAt(LocalDateTime.now());
        changeDocCiLinkMapper.insert(link);
        
        // 写 ci_change_log
        ciChangeLogService.log(item.getInstanceId(), "change_doc_linked",
            Map.of("changeDocId", changeDocId, "docNumber", doc.getDocNumber(), "title", doc.getTitle()),
            operatorId);
    }
    
    // 审计日志
    writeAuditLog(tenantId, "change_doc", "link_ci", changeDocId, "change_doc", operatorId,
        Map.of(), Map.of("linkedCount", req.getLinks().size()));
}

@Transactional
public void unlinkCiInstance(Long changeDocId, Long linkId, String tenantId, Long operatorId) {
    ChangeDocCiLink link = changeDocCiLinkMapper.selectById(linkId);
    if (link == null || !link.getChangeDocId().equals(changeDocId)) {
        throw new IllegalArgumentException("关联不存在");
    }
    
    changeDocCiLinkMapper.deleteById(linkId);
    
    // 审计日志
    writeAuditLog(tenantId, "change_doc", "unlink_ci", changeDocId, "change_doc", operatorId,
        Map.of("instanceId", link.getInstanceId()), Map.of());
}
```

**Step 3:** 在 `ChangeDocService` 注入 `ChangeDocCiLinkMapper` 和 `CiChangeLogService`

**Step 4:** 验证：编译通过

---

### Task 14: 变更文档关联 CI — Controller
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java`

**Step 1:** 添加端点
```java
@PostMapping("/{id}/ci-links")
@PreAuthorize("hasPermission('change_doc', 'update')")
public R<Void> linkCiInstances(@PathVariable Long id,
                               @Valid @RequestBody LinkCiRequest req,
                               @AuthenticationPrincipal SecurityUser cu) {
    changeDocService.linkCiInstances(id, req, cu.getTenantId(), cu.getUserId());
    return R.ok();
}

@DeleteMapping("/{id}/ci-links/{linkId}")
@PreAuthorize("hasPermission('change_doc', 'update')")
public R<Void> unlinkCiInstance(@PathVariable Long id,
                                @PathVariable Long linkId,
                                @AuthenticationPrincipal SecurityUser cu) {
    changeDocService.unlinkCiInstance(id, linkId, cu.getTenantId(), cu.getUserId());
    return R.ok();
}
```

**Step 2:** 验证：POST `/api/change-docs/{id}/ci-links` 创建关联成功

---

### Task 15: CMDB 实例详情 — 关联变更文档 API
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/controller/CiInstanceController.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/service/CiInstanceService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/ChangeDocVO.java` (新增)

**Step 1:** 创建 DTO
```java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ChangeDocVO {
    private Long id;
    private String docNumber;
    private String title;
    private String status;
    private String applicant;
    private LocalDateTime createdAt;
    private String impactLevel;
}
```

**Step 2:** 在 `CiInstanceService` 添加方法
```java
public List<ChangeDocVO> getRelatedChangeDocs(Long instanceId, String tenantId) {
    loadInstance(instanceId, tenantId);
    
    List<ChangeDocCiLink> links = changeDocCiLinkMapper.selectList(new LambdaQueryWrapper<ChangeDocCiLink>()
        .eq(ChangeDocCiLink::getInstanceId, instanceId)
        .eq(ChangeDocCiLink::getTenantId, tenantId)
        .orderByDesc(ChangeDocCiLink::getCreatedAt));
    
    return links.stream().map(link -> {
        ChangeDoc doc = changeDocMapper.selectById(link.getChangeDocId());
        if (doc == null) return null;
        
        ChangeDocVO vo = new ChangeDocVO();
        vo.setId(doc.getId());
        vo.setDocNumber(doc.getDocNumber());
        vo.setTitle(doc.getTitle());
        vo.setStatus(doc.getStatus());
        vo.setApplicant(doc.getApplicant());
        vo.setCreatedAt(doc.getCreatedAt());
        vo.setImpactLevel(link.getImpactLevel());
        return vo;
    }).filter(Objects::nonNull).collect(Collectors.toList());
}
```

**Step 3:** 注入 `ChangeDocCiLinkMapper` 和 `ChangeDocMapper`

**Step 4:** 在 `CiInstanceController` 添加端点
```java
@GetMapping("/{id}/change-docs")
@PreAuthorize("hasPermission('cmdb_instance', 'read') and hasPermission('change_doc', 'read')")
public R<List<ChangeDocVO>> getRelatedChangeDocs(@PathVariable Long id,
                                                 @AuthenticationPrincipal SecurityUser cu) {
    return R.ok(ciInstanceService.getRelatedChangeDocs(id, cu.getTenantId()));
}
```

**Step 5:** 验证：访问 `/api/cmdb/instances/{id}/change-docs` 返回变更文档列表

---

### Task 16: 变更提交时通知 CI Owner
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocWorkflowCallback.java` (或类似回调类)

**Step 1:** 在审批提交回调中添加通知逻辑
```java
@Transactional
public void onSubmitForApproval(Long changeDocId, String tenantId, Long operatorId) {
    ChangeDoc doc = loadChangeDoc(changeDocId, tenantId);
    doc.setStatus("PENDING_APPROVAL");
    changeDocMapper.updateById(doc);
    
    // 通知关联 CI 的 owner
    List<ChangeDocCiLink> links = changeDocCiLinkMapper.selectList(new LambdaQueryWrapper<ChangeDocCiLink>()
        .eq(ChangeDocCiLink::getChangeDocId, changeDocId));
    
    for (ChangeDocCiLink link : links) {
        CiInstance instance = ciInstanceMapper.selectById(link.getInstanceId());
        if (instance != null && instance.getOwner() != null) {
            User owner = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, instance.getOwner()));
            if (owner != null) {
                notificationService.notify(
                    tenantId,
                    owner.getId(),
                    "变更通知: " + doc.getTitle(),
                    String.format("您负责的 CI 实例 [%s] 关联了一个变更文档 [%s]", instance.getName(), doc.getDocNumber()),
                    "system",
                    "change_doc",
                    changeDocId
                );
            }
        }
    }
    
    // 审计日志
    writeAuditLog(tenantId, "change_doc", "submit", changeDocId, "change_doc", operatorId, Map.of(), Map.of());
}
```

**Step 2:** 验证：提交变更审批时，关联 CI 的 owner 收到通知

---

### Task 17: 前端 — 变更文档关联 CI 选择器
**Files:**
- `frontend/src/app/(dashboard)/change-docs/[id]/page.tsx`
- `frontend/src/components/changedoc/CiLinkSelector.tsx` (新增)

**Step 1:** 创建 CI 多选组件
```tsx
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface CiLink {
  instanceId: number;
  instanceName: string;
  impactLevel: string;
}

export function CiLinkSelector({ changeDocId, initialLinks, onChange }: {
  changeDocId: number;
  initialLinks: CiLink[];
  onChange: (links: CiLink[]) => void;
}) {
  const [links, setLinks] = useState<CiLink[]>(initialLinks);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (search.length > 0) {
      api.get('/cmdb/instances', { params: { keyword: search, page: 1, size: 10 } })
        .then(res => setSearchResults(res.data.items));
    } else {
      setSearchResults([]);
    }
  }, [search]);

  const addLink = (instance: any) => {
    if (links.find(l => l.instanceId === instance.id)) return;
    const newLinks = [...links, { instanceId: instance.id, instanceName: instance.name, impactLevel: 'normal' }];
    setLinks(newLinks);
    onChange(newLinks);
    setSearch('');
  };

  const removeLink = (instanceId: number) => {
    const newLinks = links.filter(l => l.instanceId !== instanceId);
    setLinks(newLinks);
    onChange(newLinks);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {links.map(link => (
          <Badge key={link.instanceId} variant="secondary" className="flex items-center gap-1">
            {link.instanceName}
            <button onClick={() => removeLink(link.instanceId)} className="ml-1">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Input
          placeholder="搜索 CI 实例..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {searchResults.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {searchResults.map(inst => (
              <div
                key={inst.id}
                className="p-2 hover:bg-muted cursor-pointer"
                onClick={() => addLink(inst)}
              >
                {inst.name} ({inst.modelName})
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2:** 在变更文档详情页集成 `CiLinkSelector`

**Step 3:** 验证：变更文档编辑页可选择/移除关联 CI

---

### Task 18: 前端 — 实例详情显示变更历史
**Files:**
- `frontend/src/app/(dashboard)/cmdb/instances/[id]/page.tsx`
- `frontend/src/components/cmdb/RelatedChangeDocsTab.tsx` (新增)

**Step 1:** 创建组件
```tsx
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function RelatedChangeDocsTab({ instanceId }: { instanceId: number }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/cmdb/instances/${instanceId}/change-docs`)
      .then(res => setDocs(res.data))
      .finally(() => setLoading(false));
  }, [instanceId]);

  if (loading) return <div>加载中...</div>;
  if (docs.length === 0) return <div className="text-muted-foreground">暂无关联变更文档</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>关联变更文档 ({docs.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>变更编号</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>影响级别</TableHead>
              <TableHead>申请人</TableHead>
              <TableHead>申请时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map(doc => (
              <TableRow key={doc.id}>
                <TableCell>
                  <a href={`/dashboard/change-docs/${doc.id}`} className="text-primary hover:underline">
                    {doc.docNumber}
                  </a>
                </TableCell>
                <TableCell>{doc.title}</TableCell>
                <TableCell><Badge>{doc.status}</Badge></TableCell>
                <TableCell>{doc.impactLevel}</TableCell>
                <TableCell>{doc.applicant}</TableCell>
                <TableCell>{new Date(doc.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

**Step 2:** 在实例详情页添加 "变更" tab

**Step 3:** 验证：实例详情页显示关联变更文档列表

---

## Phase 4D: CMDB ↔ 日报（1 天）

### Task 19: 数据库迁移 — daily_report 加 JSONB 列
**Files:**
- `backend/src/main/resources/db/migration/V28__daily_report_add_ci_instances.sql` (新增)

**Step 1:** 创建迁移脚本
```sql
-- V28: 日报关联 CI 实例（JSONB 数组）
ALTER TABLE daily_report ADD COLUMN ci_instance_ids JSONB DEFAULT '[]';
```

**Step 2:** 验证：迁移成功

---

### Task 20: DailyReport 实体加字段
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/daily/entity/DailyReport.java`

**Step 1:** 添加字段
```java
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import java.util.List;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "daily_report", autoResultMap = true)
public class DailyReport extends BaseEntity {
    // ... existing fields
    
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Long> ciInstanceIds;  // 新增
}
```

**Step 2:** 验证：编译通过

---

### Task 21: DailyReport DTO 加字段
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/daily/dto/DailyReportVO.java`
- `backend/src/main/java/com/cwgsyw/platform/module/daily/dto/CreateDailyReportRequest.java`

**Step 1:** `DailyReportVO` 添加
```java
private List<Long> ciInstanceIds;
private List<CiInstanceBriefVO> ciInstances;  // 用于展示
```

**Step 2:** `CreateDailyReportRequest` 添加
```java
private List<Long> ciInstanceIds;  // 可选
```

**Step 3:** 创建 `CiInstanceBriefVO`
```java
package com.cwgsyw.platform.module.daily.dto;

import lombok.Data;

@Data
public class CiInstanceBriefVO {
    private Long id;
    private String name;
    private String modelName;
}
```

**Step 4:** 验证：编译通过

---

### Task 22: DailyReportService 支持关联
**Files:**
- `backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportService.java`

**Step 1:** 修改 `create()` 和 `update()` 方法，保存 `ciInstanceIds`
```java
@Transactional
public DailyReportVO create(CreateDailyReportRequest req, String tenantId, Long operatorId) {
    DailyReport report = new DailyReport();
    // ... existing mapping
    report.setCiInstanceIds(req.getCiInstanceIds() != null ? req.getCiInstanceIds() : new ArrayList<>());
    dailyReportMapper.insert(report);
    
    // 写 ci_change_log
    if (req.getCiInstanceIds() != null && !req.getCiInstanceIds().isEmpty()) {
        for (Long instanceId : req.getCiInstanceIds()) {
            ciChangeLogService.log(instanceId, "daily_report_linked",
                Map.of("reportId", report.getId(), "reportDate", report.getReportDate().toString()),
                operatorId);
        }
    }
    
    // ... rest of the code
}
```

**Step 2:** 修改 VO 转换，填充 `ciInstances`
```java
private DailyReportVO toVO(DailyReport report) {
    DailyReportVO vo = new DailyReportVO();
    // ... existing mapping
    vo.setCiInstanceIds(report.getCiInstanceIds());
    
    if (report.getCiInstanceIds() != null && !report.getCiInstanceIds().isEmpty()) {
        List<CiInstanceBriefVO> briefs = report.getCiInstanceIds().stream()
            .map(id -> {
                CiInstance ci = ciInstanceMapper.selectById(id);
                if (ci == null) return null;
                CiInstanceBriefVO brief = new CiInstanceBriefVO();
                brief.setId(ci.getId());
                brief.setName(ci.getName());
                brief.setModelName(ci.getModelId());
                return brief;
            })
            .filter(Objects::nonNull)
            .collect(Collectors.toList());
        vo.setCiInstances(briefs);
    }
    
    return vo;
}
```

**Step 3:** 注入 `CiInstanceMapper` 和 `CiChangeLogService`

**Step 4:** 验证：创建日报时选择 CI 实例，列表页显示实例名称

---

### Task 23: 前端 — 日报表单加 CI 选择
**Files:**
- `frontend/src/app/(dashboard)/daily/new/page.tsx`
- `frontend/src/components/daily/DailyReportForm.tsx`

**Step 1:** 添加 CI 多选组件（复用 Task 17 的 `CiLinkSelector` 或简化版）

**Step 2:** 在日报表单中集成

**Step 3:** 验证：创建日报时可选择关联 CI

---

### Task 24: 前端 — 实例详情显示日报引用
**Files:**
- `frontend/src/app/(dashboard)/cmdb/instances/[id]/page.tsx`
- `frontend/src/components/cmdb/RelatedDailyReportsTab.tsx` (新增)

**Step 1:** 创建组件（查询 ci_change_log WHERE action='daily_report_linked'）

**Step 2:** 在实例详情页添加 "日报" tab

**Step 3:** 验证：实例详情页显示关联日报列表

---

## Phase 4E: IPAM 子模块（3-5 天）

### Task 25: 数据库迁移 — IP 池表
**Files:**
- `backend/src/main/resources/db/migration/V25__ipam_tables.sql` (新增)

**Step 1:** 创建迁移脚本（参考 spec 第 2 节）

**Step 2:** 添加 RBAC 权限种子数据
```sql
-- IPAM 权限
INSERT INTO sys_resource (code, name, description) VALUES ('ip_pool', 'IP 池', 'IP 地址池管理');

INSERT INTO sys_permission (resource_code, action, name, description) VALUES
('ip_pool', 'create', '创建', '创建 IP 池'),
('ip_pool', 'read', '查看', '查看 IP 池'),
('ip_pool', 'update', '更新', '更新 IP 池'),
('ip_pool', 'delete', '删除', '删除 IP 池'),
('ip_pool', 'allocate', '分配', '分配/释放 IP');

-- 分配给 super_admin 和 admin
INSERT INTO sys_role_permission (role_code, permission_id)
SELECT 'super_admin', id FROM sys_permission WHERE resource_code = 'ip_pool';

INSERT INTO sys_role_permission (role_code, permission_id)
SELECT 'admin', id FROM sys_permission WHERE resource_code = 'ip_pool';
```

**Step 3:** 验证：迁移成功，权限可查

---

### Task 26-35: IPAM 后端（实体、Mapper、Service、Controller）

参考现有模块（device、changedoc）的结构，创建完整的 IPAM 子模块：
- 实体：`IpPool`, `IpAllocation`
- Mapper：`IpPoolMapper`, `IpAllocationMapper`
- Service：`IpPoolService`（包含 CIDR 展开、IP 分配/释放逻辑）
- Controller：`IpPoolController`（9 个端点）

**关键实现点：**
- CIDR 展开计算 `total_count`（如 /24 = 254 个可用 IP）
- IP 分配唯一性检查
- 使用率统计

---

### Task 36-40: IPAM 前端

- `/dashboard/ipam` — IP 池列表页
- `/dashboard/ipam/pools/{id}` — 池详情（使用率图表 + 分配列表）
- CI 实例创建/编辑表单中 IP 字段改为下拉选择

---

## Phase 4F: Prometheus 集成（3-5 天）

### Task 41: 数据库迁移 — cmdb_alert 表
**Files:**
- `backend/src/main/resources/db/migration/V24__cmdb_alert.sql` (新增)

**Step 1:** 创建迁移脚本（参考 spec 第 1 节）

**Step 2:** 添加 RBAC 权限种子数据

**Step 3:** 验证：迁移成功

---

### Task 42-50: Prometheus 后端

- 实体：`CmdbAlert`
- Mapper：`CmdbAlertMapper`
- Service：`PrometheusAlertSyncService`（定时任务，拉取 Prometheus API）
- Controller：`CmdbAlertController`（3 个端点）
- 系统配置：`prometheus.url`, `prometheus.scrape_interval`, `prometheus.enabled`

**关键实现点：**
- `@Scheduled` 定时任务拉取 `/api/v1/alerts`
- 按 fingerprint 去重
- 匹配规则：IP → hostname → ci_instance_id
- 新告警 → INSERT + ci_change_log
- 已恢复 → UPDATE status='resolved' + ci_change_log

---

### Task 51-55: Prometheus 前端

- 实例详情页 "告警" tab
- 系统设置页 "Prometheus 配置" section
- CMDB 仪表盘 firing 告警 badge

---

## 验收标准

### 4A: CMDB ↔ 通知
- [ ] CI 实例状态变更触发通知
- [ ] CI 实例删除触发通知
- [ ] 通知列表点击跳转到实例详情

### 4B: CMDB ↔ 密码库
- [ ] 设备可选择关联 CI 实例
- [ ] 实例详情页显示关联设备列表
- [ ] 设备列表显示关联 CI 实例名称

### 4C: CMDB ↔ 变更文档
- [ ] 变更文档可关联多个 CI 实例
- [ ] 变更提交审批时通知 CI owner
- [ ] 实例详情页显示关联变更文档列表

### 4D: CMDB ↔ 日报
- [ ] 日报可选择关联 CI 实例
- [ ] 实例详情页显示关联日报列表

### 4E: IPAM
- [ ] IP 池 CRUD
- [ ] IP 分配/释放
- [ ] 使用率统计
- [ ] CI 实例创建时可选择 IP

### 4F: Prometheus
- [ ] 定时拉取 Prometheus 告警
- [ ] 告警自动匹配 CI 实例
- [ ] 实例详情页显示告警历史
- [ ] 告警触发通知

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| Prometheus 不可用 | 定时任务 catch 所有异常，记录日志，不影响 CMDB |
| IP 池大量 IP 导致查询慢 | 分页查询，索引优化 |
| CI 实例删除后关联数据孤立 | 软删除，前端显示 "已删除" |
| 日报 JSONB 列存储大量 instance_id | 限制数组最大长度（50） |

---

## 依赖关系

```
4A (通知) ─┬─> 4C (变更文档，复用通知逻辑)
           └─> 4F (Prometheus，告警触发通知)

4B (密码库) ─> 无依赖
4D (日报) ─> 无依赖
4E (IPAM) ─> 无依赖
```

---

## 附录：新增文件清单

### 后端
- `module/cmdb/service/CiNotificationService.java`
- `module/cmdb/dto/ChangeDocVO.java`
- `module/cmdb/dto/DailyReportVO.java`
- `module/changedoc/entity/ChangeDocCiLink.java`
- `module/changedoc/ChangeDocCiLinkMapper.java`
- `module/changedoc/dto/LinkCiRequest.java`
- `module/ipam/*` (完整子模块)
- `module/cmdb/entity/CmdbAlert.java`
- `module/cmdb/mapper/CmdbAlertMapper.java`
- `module/cmdb/service/PrometheusAlertSyncService.java`
- `module/cmdb/controller/CmdbAlertController.java`

### 前端
- `components/notification/NotificationItem.tsx`
- `components/device/CiInstanceSelect.tsx`
- `components/cmdb/RelatedDevicesTab.tsx`
- `components/cmdb/RelatedChangeDocsTab.tsx`
- `components/cmdb/RelatedDailyReportsTab.tsx`
- `components/cmdb/RelatedAlertsTab.tsx`
- `components/changedoc/CiLinkSelector.tsx`
- `app/(dashboard)/ipam/*` (IPAM 页面)

### 数据库迁移
- `V24__cmdb_alert.sql`
- `V25__ipam_tables.sql`
- `V26__device_add_ci_instance.sql`
- `V27__change_doc_ci_link.sql`
- `V28__daily_report_add_ci_instances.sql`

---

**总计：** 55 个 task，预估 11-18 天完成。
