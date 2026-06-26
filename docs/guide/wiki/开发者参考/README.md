# 开发者参考

面向平台维护者，覆盖数据模型、模块架构、关键设计决策与扩展指引。

## 章节

1. [数据模型](./01-数据模型.md) — 5 张表结构与关系
2. [后端架构](./02-后端架构.md) — 模块文件、服务职责、调用链
3. [前端架构](./03-前端架构.md) — 页面/组件/API 层
4. [关键设计决策](./04-关键设计决策.md) — 存储/搜索/附件/工作流的取舍
5. [扩展指引](./05-扩展指引.md) — 常见二次开发场景

## 模块文件结构

```
后端: backend/src/main/java/com/cwgsyw/platform/module/wiki/
  entity/    WikiSpace, WikiPage, WikiPageVersion, WikiBacklink, WikiPageAcl
  dto/       WikiSpaceVO, WikiPageVO, WikiPageTreeVO, WikiVersionVO,
             WikiBacklinkVO, WikiSearchResultVO, GraphVO, WikiAclDTO, AclEntryDTO,
             CreateSpaceRequest, CreatePageRequest, SavePageRequest, MovePageRequest
  *Mapper    WikiSpaceMapper, WikiPageMapper, WikiPageVersionMapper,
             WikiBacklinkMapper, WikiPageAclMapper
  *Service   WikiSpaceService, WikiPageService, WikiBacklinkService,
             WikiAclService, WikiAttachmentService, WikiExportService
  WikiController          全部 23 个 REST 端点
  WikiPublishListener     Flowable 审批回调（@Component("wikiPublishListener")）

数据库: backend/src/main/resources/db/migration/V53__wiki_module.sql

前端: frontend/src/
  types/wiki.ts                          类型定义
  lib/wiki-api.ts                        API 层
  app/(dashboard)/wiki/
    page.tsx                             空间列表
    [spaceId]/layout.tsx                 三栏布局
    [spaceId]/page.tsx                   空间首页
    [spaceId]/[pageId]/page.tsx          阅读页
    [spaceId]/[pageId]/edit/page.tsx     编辑器
    [spaceId]/graph/page.tsx             知识图谱
    search/page.tsx                      搜索
  components/wiki/
    WikiTreeSidebar.tsx                  页面树
    WikiBacklinksPanel.tsx               反向链接面板
    WikiVersionsPanel.tsx                版本面板
    WikiAclDialog.tsx                    ACL 对话框
  components/layout/Sidebar.tsx          已加「知识库」导航项
```
