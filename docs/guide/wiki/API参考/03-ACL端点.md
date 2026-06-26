# ACL 端点

页面级访问控制的读写。权限 `wiki:manage_acl`。语义详见 [管理员指南 / 页面 ACL 配置](../管理员指南/02-页面ACL配置.md)。

## GET /api/wiki/pages/{id}/acl

读取页面 ACL。

**响应（默认继承）**
```json
{ "code": 200, "data": { "page_id": 1, "inherited": true, "entries": [] } }
```

**响应（自定义）**
```json
{
  "code": 200,
  "data": {
    "page_id": 1,
    "inherited": false,
    "entries": [
      { "subject_type": "role", "subject_id": 4, "subject_name": "运维组员",
        "permissions": ["read"] }
    ]
  }
}
```

`subject_name` 由后端解析（role→角色名 / group→组名 / user→用户名）。

---

## PUT /api/wiki/pages/{id}/acl

全量替换页面 ACL。

**请求**
```json
{
  "page_id": 1,
  "inherited": false,
  "entries": [
    { "subject_type": "role",  "subject_id": 4, "permissions": ["read"] },
    { "subject_type": "group", "subject_id": 2, "permissions": ["read","write"] },
    { "subject_type": "user",  "subject_id": 9, "permissions": ["read","write","delete","publish"] }
  ]
}
```

- `inherited=true`：忽略 entries，恢复继承父级
- `inherited=false`：用 entries 作为本页自定义 ACL（先软删旧条目再写入）
- `subject_type` ∈ `role | group | user`
- `permissions` 子集 ⊆ `["read","write","delete","publish"]`，非法动词被过滤
- 写审计：`module=wiki`, `action=acl_update`，含前后快照

**响应**：`{ "code": 200, "message": "success" }`

---

## 生效判定（后端逻辑）

调用任意页面读写接口时，后端 `WikiAclService.hasPermission` 判定：

1. admin/super_admin（groupScope=tenant/platform）→ 直接放行
2. 自下而上沿父链找第一个 `inherited=false` 的祖先 → 用其 ACL
3. 整条链都继承 → 无 ACL 限制（仅 RBAC）
4. 命中的 ACL 行中，匹配用户的 role/group/user 且含所需动词 → 放行
