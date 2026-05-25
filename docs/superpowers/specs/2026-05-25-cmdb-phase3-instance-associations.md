# CMDB Phase 3: 实例关联关系 — 设计规格

**日期：** 2026-05-25  
**状态：** 已批准，待实施  
**分支：** `feature/cmdb`

---

## 目标

在 CMDB 实例层面建立和查询两个 CI 之间的关联关系，支持在实例详情页快速查看/添加关联，以及独立关联管理页的完整操作。为 Phase 4 的影响范围分析预留扩展点。

**Phase 3 范围：** 实例详情页关联面板 + 独立关联管理页  
**Phase 4（不在本期）：** 变更文档"影响范围"字段与关联链打通

---

## 前提条件

Phase 1 元数据层（`ci_association_kind`、`ci_association_def`）已完成，内置种类：`bk_mainline`、`belong`、`run`、`connect`、`depend`、`deploy`。

---

## 数据层

### V16 Migration — `ci_instance_rel`

```sql
CREATE TABLE ci_instance_rel (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    def_id      VARCHAR(64)  NOT NULL,
    src_id      BIGINT       NOT NULL,
    dst_id      BIGINT       NOT NULL,
    attrs       JSONB        NOT NULL DEFAULT '{}',
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at  TIMESTAMP,
    deleted_by  BIGINT,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_by  BIGINT
);

CREATE INDEX idx_ci_rel_src    ON ci_instance_rel(tenant_id, src_id) WHERE NOT is_deleted;
CREATE INDEX idx_ci_rel_dst    ON ci_instance_rel(tenant_id, dst_id) WHERE NOT is_deleted;
CREATE INDEX idx_ci_rel_attrs  ON ci_instance_rel USING GIN(attrs)   WHERE NOT is_deleted;
CREATE UNIQUE INDEX idx_ci_rel_unique
    ON ci_instance_rel(tenant_id, def_id, src_id, dst_id) WHERE NOT is_deleted;
```

**字段说明：**
- `def_id`：引用 `ci_association_def.def_id`，决定允许的 src/dst 模型及 mapping 规则
- `attrs JSONB`：当前为空，Phase 4 用于存储关联属性（如权重、生效时间等）
- 软删除模式与项目其他表一致

### Mapping 校验规则

| mapping | src_id 限制 | dst_id 限制 |
|---------|------------|------------|
| `1:1`   | 同 def 下最多 1 条 | 同 def 下最多 1 条 |
| `1:n`   | 无限制 | 同 def 下最多 1 条 |
| `n:n`   | 无限制 | 无限制 |

校验失败时返回 HTTP 400，message 格式：
> `"[CI名称]（[模型名]）在此关联定义下已被占用，无法建立 [1:1/1:n] 关联"`

---

## 后端

### 新增文件

| 文件 | 说明 |
|------|------|
| `db/migration/V16__cmdb_instance_rel.sql` | 建表 migration |
| `entity/CiInstanceRel.java` | MyBatis-Plus 实体，`@TableName(autoResultMap=true)`，attrs 用 `JacksonTypeHandler` |
| `CiInstanceRelMapper.java` | 含 `findBySrcOrDst`、`countBySrc`、`countByDst` 方法 |
| `dto/CiInstanceRelVO.java` | 关联详情 VO（含两端名称、模型名、方向标签） |
| `dto/CiRelGroupVO.java` | 按 kind 分组的关联列表 |
| `dto/CreateRelRequest.java` | `{ def_id, src_id, dst_id, attrs? }` |
| `CiInstanceRelService.java` | 创建/删除/查询，含 mapping 强制校验和审计日志 |
| `CiInstanceRelController.java` | REST 控制器，`@PreAuthorize` |

### API 路由

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/cmdb/rel/{instanceId}` | `cmdb_instance:read` | 查询某实例所有关联（正向+反向合并，按 kind 分组） |
| `POST` | `/api/cmdb/rel` | `cmdb_instance:create` | 建立关联，触发 mapping 校验 |
| `DELETE` | `/api/cmdb/rel/{relId}` | `cmdb_instance:delete` | 软删除单条关联 |
| `GET` | `/api/cmdb/rel/search` | `cmdb_instance:read` | 搜索实例，参数：`modelId`、`keyword`、`page`（默认1）、`size`（默认10） |

### `GET /rel/{instanceId}` 响应结构

```json
{
  "groups": [
    {
      "kind_id": "belong",
      "kind_name": "属于",
      "src_to_dst": "属于",
      "dst_to_src": "包含",
      "relations": [
        {
          "id": 1,
          "def_id": "host_belong_app",
          "is_src": true,
          "peer_id": 5,
          "peer_name": "app-server-01",
          "peer_model_id": "app",
          "peer_model_name": "应用",
          "direction_label": "属于",
          "attrs": {}
        }
      ]
    }
  ]
}
```

### RBAC

不新增资源码。关联是实例数据的一部分，复用：
- `cmdb_instance:read` — 查询关联
- `cmdb_instance:create` — 建立关联
- `cmdb_instance:delete` — 删除关联

### 审计日志

所有写操作（建立/删除关联）写 `audit_log`，`module=cmdb`，`target_type=ci_instance_rel`。

---

## 前端

### 修改文件

**`instances/[modelId]/[id]/page.tsx`**  
在属性区块下方新增"关联关系"折叠卡片：

```
┌─ 关联关系 ─────────────────────────────────┐
│  [属于] belong                              │
│  ├ app-server-01（应用）  [×]              │
│  └ [+ 添加]                                │
│                                            │
│  [运行] run                                │
│  └（空）  [+ 添加]                         │
│                                            │
│             [管理全部关联 →]               │
└────────────────────────────────────────────┘
```

- 调用 `GET /rel/{id}` 获取数据
- `[+ 添加]` 按钮触发 Dialog（见下）
- `[×]` 调用 `DELETE /rel/{relId}`，有 confirm
- `[管理全部关联 →]` 跳转独立管理页

### 新增文件

**`instances/[modelId]/[id]/associations/page.tsx`**  
独立关联管理页：
- 表格列：关联种类、方向标签、对端 CI 名称/模型、创建时间、操作
- 支持按 kind 下拉筛选
- 删除按钮 + confirm

### 添加关联 Dialog

1. **关联定义下拉**：只列出 `src_model_id=currentModel` 或 `dst_model_id=currentModel` 的 def，由前端从已有模型元数据过滤（`GET /cmdb/meta/association-defs` 已有数据）
2. **目标实例搜索**：调用 `GET /rel/search?modelId=X&keyword=Y`；默认展示最近 5 条（`keyword` 为空时返回最新创建的实例）
3. **错误展示**：POST 失败时 mapping 校验错误以**红色内联文字**显示在 Dialog 内，不 toast
   - 格式：`web-server-01（主机）在此关联定义下已被占用，无法建立 1:1 关联`

---

## 不在本期范围

- 关联图谱/拓扑树可视化（Phase 4）
- 变更文档"影响范围"字段打通（Phase 4）
- 关联属性 (`attrs`) 的编辑 UI（Phase 4，当前存储为空 `{}`）
- 跨租户关联

---

## 文件变更清单

**后端新增（8 个文件）：**
- `db/migration/V16__cmdb_instance_rel.sql`
- `module/cmdb/entity/CiInstanceRel.java`
- `module/cmdb/CiInstanceRelMapper.java`
- `module/cmdb/dto/CiInstanceRelVO.java`
- `module/cmdb/dto/CiRelGroupVO.java`
- `module/cmdb/dto/CreateRelRequest.java`
- `module/cmdb/CiInstanceRelService.java`
- `module/cmdb/CiInstanceRelController.java`

**前端修改（1 个文件）：**
- `app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx`

**前端新增（1 个文件）：**
- `app/(dashboard)/cmdb/instances/[modelId]/[id]/associations/page.tsx`
