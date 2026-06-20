# P0 Bug Brief: CMDB 全子模块崩溃 + API 403

## 背景
用户在浏览器访问 `http://192.168.50.101/cmdb/models` 查看 CMDB 模型时，页面无模型数据；进一步确认 `http://192.168.50.101/cmdb` 下所有子模块都崩溃，页面提示 `This page couldn’t load`。

## 用户已确认
- 用户处于已登录状态。
- 访问入口为 nginx 地址：`http://192.168.50.101`，不是直连 Next.js 3001。
- 影响范围从 `/cmdb/models` 扩大为 `/cmdb` 下全子模块。

## 浏览器 Console 证据
以下请求均返回 403：
- `/api/notifications/unread-count`
- `/api/cmdb/instances?page=1&size=20`
- `/api/cmdb/models?size=100`
- `/api/cmdb/models?page=1&size=20`
- `/api/cmdb/models?group=infra&page=1&size=20`
- `/api/cmdb/models?group=network&page=1&size=20`
- `/api/cmdb/models?group=security&page=1&size=20`
- `/api/cmdb/models?group=cloud&page=1&size=20`

## 问题概述
CMDB 模块在用户已登录情况下仍然无法访问核心 API，多个接口返回 403，导致模型、实例以及 CMDB 子模块页面整体不可用。

## 初步排查方向
工程师必须先复现和定位，不要猜测修复。重点检查：
1. 前端请求是否携带 token / cookie / Authorization header。
2. nginx 代理是否转发 Authorization/Cookie。
3. 后端 Spring Security / RBAC 权限表达式是否与当前用户权限一致。
4. CMDB Controller 权限注解是否从 `read`/`write` 改动后未同步菜单/角色权限种子数据。
5. SSR/React Query 是否在未 hydration 或未认证态提前请求，导致 403 并触发页面崩溃。
6. `/api/notifications/unread-count` 403 是否为全局 layout 请求导致页面级崩溃的共同根因。

## 复现步骤
1. 登录系统。
2. 访问 `http://192.168.50.101/cmdb`。
3. 访问 `http://192.168.50.101/cmdb/models`。
4. 打开浏览器 DevTools Console/Network。
5. 观察 CMDB 页面是否显示 `This page couldn’t load`，以及 API 是否返回 403。

## 验收标准
- 已登录用户访问 `/cmdb` 及所有 CMDB 子模块不再崩溃。
- `/api/cmdb/models?page=1&size=20` 返回 200，并显示模型数据。
- `/api/cmdb/models?size=100` 返回 200。
- `/api/cmdb/instances?page=1&size=20` 返回 200。
- `/api/notifications/unread-count` 不再导致 CMDB 页面崩溃；若无权限应降级处理，不影响主页面。
- nginx 地址 `http://192.168.50.101` 下验证通过。
- 必须包含后端/API 验证和浏览器验证证据。

## 不做范围
- 不重构 CMDB 大模块。
- 不新增功能。
- 不绕过认证或扩大权限到不安全状态。

## 优先级
P0：CMDB 全模块不可用，阻断验收和日常使用。
