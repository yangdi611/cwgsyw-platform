# 架构设计：changedoc 与 cmdb 解耦方案

> 基于 `changedoc-cmdb-coupling-analysis.md` 耦合分析报告  
> 设计日期: 2026-06-10  
> 对应 PRD: `specs/2026-06-10-changedoc-refactor-prd.md`

---

## 一、核心决策

### 决策 1: 采用 Proxy 模式 — 引入 CI 代理层

changedoc 后端新增 2 个代理端点，内部通过 Spring 服务调用 cmdb 模块，前端不再直接访问 `/cmdb/*`。

**为何不选择事件驱动机制？**

事件驱动（EventBus/Kafka）适合异步解耦场景（如 cmdb 变更后通知 changedoc 更新缓存），但当前耦合点是**前端同步查询** CI 数据，事件驱动对同步读请求不适用。未来若需 cmdb CI 变更后实时同步到 changedoc（如失效缓存），可在代理层下叠加事件监听。

**为何不引入独立中间层（BFF）？**

- 当前架构下 changedoc 是唯一访问 cmdb CI 数据的消费者，引入独立中间层服务会新增网络跳和部署复杂度
- 代理端点部署在 changedoc 进程内，零网络延迟，响应时间与直调 CMDB 相当（< 500ms）

### 决策 2: 渐进式实体层删除（3 阶段）

ChangeDoc 实体 12 个遗留字段不能在单个 migration 中一次性删除（不可逆操作），采用：

| 阶段 | 操作 | 可回滚 |
|------|------|--------|
| Phase 1 | 新建 migration 合并旧列数据到 `fieldsData`（冗余写入） | ✅ |
| Phase 2 | 移除 Java 实体字段 + 所有引用代码 | ✅ (仅代码) |
| Phase 3 | 新建 migration 执行 `ALTER TABLE ... DROP COLUMN` | ❌ (需备份) |

### 决策 3: 前端双模板对齐

新建页支持两步选择：申请单模板（必选）+ 方案模板（可选）。详情页根据 `applicationFieldConfig` / `planFieldConfig` 分别渲染两组字段区域。

### 决策 4: 权限模型变更

CI 代理端点使用 `change_doc:read` 权限，内部调用 cmdb 服务层（绕过 `@PreAuthorize`）。用户不再需要持有 `cmdb_instance:read` 即可使用 CI 选择器。

### 决策 5: Export / AI 保持现状

ExportService 和 AiGatewayService 已从 `fieldsData` 读取数据，无需修改核心逻辑，仅需确认 key 名对齐。

---

## 二、架构图

### 现状 — 耦合数据流

```
┌──────────────────────────────────────────────────────────┐
│                        Frontend                          │
│                                                          │
│  change-docs/new/page.tsx                                │
│    │                                                     │
│    ├──── GET /cmdb/instances/search ──── CP-1 直调       │
│    ├──── GET /cmdb/topology/{id} ─────── CP-2 直调       │
│    │                                                     │
│    ├─ 需要 cmdb_instance:read 权限 ──── CP-4 权限级联    │
│    └─ CiSnapshot interface 依赖 CMDB DTO ─ CP-3 类型耦合 │
│                                                          │
│  change-docs/[id]/page.tsx                               │
│    └─ ChangeDocVO 未对齐双模板 ──────── CP-6             │
└──────────────────────────────────────────────────────────┘
```

### 目标 — 解耦后架构

```
┌─────────────────────────────────────────┐
│              Frontend                   │
│                                         │
│  change-docs/new/page.tsx               │
│    │                                    │
│    ├─ GET /api/change-docs/ci/search    │  ← changedoc 自有端点
│    ├─ GET /api/change-docs/ci/topo/{id} │  ← changedoc 自有端点
│    │                                    │
│    ├─ 仅需 change_doc:read              │  ← 权限解耦
│    └─ CiSearchVO / CiTopoNodeVO          │  ← changedoc 自有 DTO
│                                         │
│  change-docs/[id]/page.tsx              │
│    └─ applicationFieldConfig +          │
│       planFieldConfig 双区域渲染         │
└────────────────────┬────────────────────┘
                     │ HTTP (same origin)
┌────────────────────▼────────────────────┐
│         Backend: changedoc 模块          │
│                                         │
│  ChangeDocController                    │
│    + GET  /api/change-docs/ci/search    │  NEW
│    + GET  /api/change-docs/ci/topo/{id} │  NEW
│         │                               │
│         ▼                               │
│  ChangeDocService                       │
│    + searchCi(keyword) → List<CiSearchVO>    │  NEW
│    + getCiTopology(id, depth) → CiTopoResult │  NEW
│         │                               │
│         │ @Autowired (Spring DI)        │
│         ▼                               │
│  ┌─────────────────────┐                │
│  │  cmdb 模块 (同进程)  │                │
│  │                     │                │
│  │ CiInstanceService   │                │
│  │ CiTopologyService   │                │
│  └─────────────────────┘                │
│                                         │
│  ChangeDoc 实体                          │
│    fieldsData (Map)     ← 唯一数据承载   │
│    applicationTemplateId                │
│    planTemplateId                       │
│    title (NOT NULL 桥接，后续 migration) │
│    移除: 12 遗留单字段 + deprecated templateId │
└─────────────────────────────────────────┘
```

---

## 三、接口契约

### 3.1 CI 搜索代理

```
GET /api/change-docs/ci/search
权限: change_doc:read

Request:
  keyword   string   (required) 搜索关键词
  size      int      (optional, default 10, max 50) 返回条数

Response: R<CiSearchResultVO>
  {
    "code": 200,
    "data": {
      "records": [
        {
          "id": 123,
          "name": "web-server-01",
          "modelId": "server",
          "modelName": "服务器"
        }
      ],
      "total": 42
    }
  }
```

**内部实现**:
```java
// ChangeDocService
public CiSearchResultVO searchCi(String tenantId, String keyword, int size) {
    CiInstanceSearchResult r = ciInstanceService.searchAcrossModels(
        tenantId, keyword, null, 1, size);
    return mapToCiSearchResultVO(r);  // changedoc 自有 DTO 映射
}
```

### 3.2 CI 拓扑代理

```
GET /api/change-docs/ci/topology/{instanceId}
权限: change_doc:read

Request:
  instanceId  long     (path variable) 根 CI 实例 ID
  depth       int      (optional, default 2, min 1, max 5) 拓扑深度

Response: R<CiTopologyResultVO>
  {
    "code": 200,
    "data": {
      "nodes": [
        {
          "id": 123,
          "name": "web-server-01",
          "modelId": "server",
          "modelName": "服务器",
          "isRoot": true
        }
      ],
      "edges": [...]
    }
  }
```

**内部实现**:
```java
// ChangeDocService
public CiTopologyResultVO getCiTopology(String tenantId, Long instanceId, int depth) {
    CiTopologyResult r = ciTopologyService.getTopology(tenantId, instanceId, depth);
    return mapToCiTopologyResultVO(r);  // changedoc 自有 DTO 映射
}
```

### 3.3 Changedoc 自有 CI DTO

```
// backend/.../changedoc/dto/CiSearchResultVO.java
@Data
public class CiSearchResultVO {
    private List<CiRecord> records;
    private long total;
    
    @Data
    public static class CiRecord {
        private Long id;
        private String name;
        private String modelId;
        private String modelName;
    }
}

// backend/.../changedoc/dto/CiTopologyResultVO.java
@Data
public class CiTopologyResultVO {
    private List<TopoNode> nodes;
    private List<TopoEdge> edges;
    
    @Data
    public static class TopoNode {
        private Long id;
        private String name;
        private String modelId;
        private String modelName;
        private boolean isRoot;
    }
    
    @Data
    public static class TopoEdge {
        private Long id;
        private Long srcId;
        private Long dstId;
        private String label;
        private String defId;
    }
}
```

### 3.4 ChangeDocVO 双模板对齐（已部分完成）

```java
// ChangeDocVO — 后端已正确返回双模板字段:
//   applicationTemplateId, applicationTemplateName,
//   planTemplateId, planTemplateName,
//   applicationFieldConfig, planFieldConfig
// 
// 前端 TypeScript 接口需对齐:
interface ChangeDocVO {
  // ... existing fields
  applicationTemplateId: number | null
  applicationTemplateName: string | null
  planTemplateId: number | null
  planTemplateName: string | null
  applicationFieldConfig: FieldConfigVO[] | null
  planFieldConfig: FieldConfigVO[] | null
  // 移除: templateId, templateName, fieldConfig
}
```

---

## 四、数据流优化

### 4.1 CI 选择器数据流

```
用户输入关键词
  │
  ▼
┌─ Frontend ─────────────────────────────────────┐
│  debounce 300ms                                │
│  useQuery → GET /api/change-docs/ci/search     │
│    params: { keyword, size: 10 }               │
└────────────────────┬───────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────┐
  │  ChangeDocController.searchCi()              │
  │  @PreAuthorize("change_doc:read")            │
  │                                              │
  │  ChangeDocService.searchCi()                 │
  │    │                                         │
  │    ├─ ciInstanceService.searchAcrossModels() │  ← Spring DI
  │    │  (同进程调用，零网络开销)                │
  │    │                                         │
  │    └─ mapToCiSearchResultVO()                │  ← DTO 转换
  └──────────────────┬──────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────┐
  │  Frontend 接收 changedoc 自有 DTO            │
  │  CiRecord[] → 渲染下拉列表                   │
  └─────────────────────────────────────────────┘
```

### 4.2 拓扑推荐数据流

```
用户选中某个 CI
  │
  ▼
┌─ Frontend ─────────────────────────────────────┐
│  useQuery → GET /api/change-docs/ci/topo/{id}  │
│    params: { depth: 2 }                        │
└────────────────────┬───────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────┐
  │  ChangeDocController.getCiTopology()          │
  │                                              │
  │  ChangeDocService.getCiTopology()            │
  │    │                                         │
  │    ├─ ciTopologyService.getTopology()        │  ← Spring DI
  │    └─ mapToCiTopologyResultVO()              │
  └──────────────────┬──────────────────────────┘
                     │
  ┌──────────────────▼──────────────────────────┐
  │  Frontend 渲染推荐列表                        │
  │  nodes[] → 关联 CI 建议                      │
  └─────────────────────────────────────────────┘
```

### 4.3 双模板数据流

```
新建页
  ├─ 选择申请单模板 → fetch /api/change-docs/fields?templateId=app
  ├─ 选择方案模板(可选) → fetch /api/change-docs/fields?templateId=plan
  ├─ 填写 fieldsData[field_key] = value
  └─ POST /api/change-docs { applicationTemplateId, planTemplateId, fieldsData }

详情页
  GET /api/change-docs/{id} →
  {
    applicationFieldConfig: [...],  // 申请单区域
    planFieldConfig: [...],         // 方案区域
    fieldsData: { key: value }      // 包含两组字段的值
  }
```

---

## 五、向后兼容策略

### 5.1 API 兼容

| 端点 | 策略 |
|------|------|
| `/api/change-docs/*` | 路径不变、请求/响应结构兼容（仅扩展字段） |
| `/api/cmdb/instances/search` | 保持不变，仅 changedoc 前端停止调用 |
| `/api/cmdb/topology/{id}` | 保持不变，仅 changedoc 前端停止调用 |

### 5.2 数据兼容

| 场景 | 策略 |
|------|------|
| 旧格式 ChangeDoc (含旧列数据) | migration 合并到 fieldsData，旧列数据保留在 DB 直到 Phase 3 |
| 旧格式 fieldsData (key 名不一致) | Service 层读取时兼容旧 key 名（`change_desc` → `changeDesc` 映射） |
| 已有变更文档查看/导出 | ExportService 已从 fieldsData 读取，无需额外处理 |
| 已有变更文档审批 | 审批流程不变 |

### 5.3 权限兼容

| 用户角色 | 现状 | 解耦后 |
|----------|------|--------|
| 仅有 `change_doc:read` | CI 选择器 403 | CI 选择器正常 |
| 有 `change_doc:read` + `cmdb_instance:read` | CI 选择器正常 | CI 选择器正常 |
| 仅有 `cmdb_instance:read` | CI 选择器正常 | CI 选择器不可用（changedoc 权限独立） |

### 5.4 前端路由

不变：
- `/change-docs` — 列表页
- `/change-docs/new` — 新建页
- `/change-docs/[id]` — 详情页

---

## 六、风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| CI 代理端点性能退化 | 低 | 用户感知延迟 | 同进程调用，零网络开销；如遇瓶颈可加简单内存缓存 |
| DTO 映射遗漏字段 | 中 | 前端显示不全 | 集成测试覆盖所有字段映射 |
| 旧字段数据丢失 | 低 | 历史数据不可读 | Phase 1 migration 先合并到 fieldsData，验证后删列 |
| 前端 CI 选择器重构引入 bug | 中 | 新建页不可用 | 保持原 UI 交互不变，仅改 API 调用路径 |
| CMDB 服务层 API 变更 | 低 | 代理端点编译/运行失败 | changedoc 依赖 cmdb 编译时可见；CI 在编译阶段捕获 |

---

## 七、关键技术约束

1. **同进程调用**: changedoc 直接注入 cmdb Service Bean（Spring DI），不走 HTTP 或 RPC
2. **DTO 隔离**: changedoc 定义自有 CI DTO，不依赖 cmdb 的 `CiInstanceSearchVO` / `CiTopologyResult` 包
3. **安全边界**: 代理端点使用 changedoc 的 `@PreAuthorize`，内部调用 cmdb Service 层（非 Controller）
4. **事务边界**: CI 查询为只读操作，不参与 changedoc 的 `@Transactional` 事务
5. **数据库隔离**: cmdb 表（`ci_instance`, `ci_instance_rel` 等）仅通过 cmdb Mapper 访问，changedoc 不直连 cmdb 表

---

*下一步: 见迁移计划 `../plans/2026-06-10-changedoc-decoupling-migration.md`*
