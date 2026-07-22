# REM-P1-054 执行入口

按全局 Codex Goal 与本目录 SPEC，只修复 `CONFIG-004` 的水印 angle/API/UI/即时预览链。

硬约束：复用既有 `watermark.angle`；不迁移 schema、不改权限/路由；非法请求零部分写；完成 Java、frontend、当前容器与真实 Playwright L1-L3；原配置产品 API 精确恢复；提交前 GitNexus detect；独立提交并 no-ff 合并到 `lint-fix` 后同 run affected-only 重验。
