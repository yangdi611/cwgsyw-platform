# API 参考

> Base URL：`/api/wiki` · 认证：`Authorization: Bearer <JWT>` · JSON 字段：SNAKE_CASE
> 统一响应包装：`{ "code": 200, "message": "success", "data": <T> }`

所有端点已通过真实 API 调用验收（superadmin / `Admin@123`）。

## 章节

1. [空间端点](./01-空间端点.md) — spaces CRUD + tree + graph + export
2. [页面端点](./02-页面端点.md) — pages CRUD + move + 版本 + 发布 + backlinks
3. [ACL 端点](./03-ACL端点.md) — 读写页面 ACL
4. [附件与搜索端点](./04-附件与搜索.md) — attachments + search
5. [错误码与约定](./05-错误码与约定.md)

## 端点总览（23 个）

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/spaces` | wiki:read | 空间列表 |
| POST | `/spaces` | wiki:create | 创建空间 |
| PUT | `/spaces/{id}` | wiki:update | 更新空间 |
| DELETE | `/spaces/{id}` | wiki:delete | 删除空间（需为空） |
| GET | `/spaces/{id}/tree` | wiki:read | 页面树 |
| GET | `/spaces/{id}/graph` | wiki:read | 知识图谱 |
| GET | `/spaces/{id}/export` | wiki:read | 批量导出 zip |
| GET | `/pages/{id}` | wiki:read + ACL read | 页面详情 |
| POST | `/pages` | wiki:create + 父 ACL write | 新建页面 |
| PUT | `/pages/{id}` | wiki:update + ACL write | 保存页面 |
| DELETE | `/pages/{id}` | wiki:delete + ACL delete | 删除页面（级联） |
| POST | `/pages/{id}/move` | wiki:update + ACL write | 移动/排序 |
| POST | `/pages/{id}/submit` | wiki:update | 提交审批 |
| POST | `/pages/{id}/publish` | wiki:publish | 直接发布 |
| GET | `/pages/{id}/versions` | wiki:read | 版本列表 |
| POST | `/pages/{id}/revert/{version}` | wiki:update + ACL write | 回滚版本 |
| GET | `/pages/{id}/export` | wiki:read + ACL read | 单页导出 |
| GET | `/pages/{id}/backlinks` | wiki:read | 反向链接 |
| GET | `/pages/{id}/acl` | wiki:manage_acl | 读取 ACL |
| PUT | `/pages/{id}/acl` | wiki:manage_acl | 设置 ACL |
| POST | `/attachments` | wiki:update + ACL write | 上传附件 |
| GET | `/attachments/{fileId}` | wiki:read | 附件流式下载 |
| GET | `/search` | wiki:read | 全文搜索 |
