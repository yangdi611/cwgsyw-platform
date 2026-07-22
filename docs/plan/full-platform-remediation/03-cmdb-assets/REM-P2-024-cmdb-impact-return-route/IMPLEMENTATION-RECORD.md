# 实施记录

## 2026-07-17

- L4 首次失败：加载中的返回链接为 `/cmdb/instances/by-model/_/20`，而 API 最终返回 `rootModelId=host`。
- GitNexus：`ImpactAnalysisPage` upstream risk LOW，direct callers=0，两个本页流程。
- 实施：未加载 `rootModelId` 时渲染不可点击文本；数据就绪后才渲染真实模型路由 Link。
- 验证：`npm run typecheck`、定向 eslint、当前分支 frontend production build 通过；真实 Playwright 返回 `host/20` 详情路径，零 Console/4xx/5xx。无夹具或清理项。
