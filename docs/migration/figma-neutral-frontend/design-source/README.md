# Figma Neutral Redesign 资料包

> 本目录是 Figma Neutral 正式设计定义与设计执行资料，不包含旧前端 refactor 文档。

## 唯一定位

本目录只负责 `CWGSYW/UI + Variables` 的全新 Figma 设计。该设计将在下一次系统前端重构时成为唯一视觉、Token、组件 API 和布局设计源。

本目录只定义未来要实现的新设计。旧前端 refactor、组件入口收敛和兼容迁移资料已清理，不再构成可引用的设计输入。
- 后者不得作为前者的颜色、Token、组件 API、外观、尺寸、间距、圆角、阴影或布局参考。
- 当前代码只能提供功能和业务状态覆盖清单。

## 颜色合同

- 常规 UI 只使用 `neutral/*`。
- Info、Success、Warning、Danger 只使用对应 `status/*`，且必须传达真实状态。
- Primary、Hover、Pressed、Selected、Focus、Disabled、背景、文本、边框、Overlay 全部使用 Neutral。
- 禁止品牌蓝、紫色 Accent、彩色主按钮和装饰性色块。
- `blue/*` 等错误语义变量即使值为灰色也必须迁移或删除。

## 单向实施关系

```text
系统功能清单 -> Figma 全新设计 -> 新 React 组件 / 新 CSS Token -> 前端替换与功能回归
```

禁止反向使用当前 React 组件、V2 Token 或当前页面显色结果定义 Figma。

## 文档索引

| 文档 | 用途 |
|---|---|
| `START-HERE.md` | 项目负责人启动、续跑和验收的最短路径 |
| `FIGMA-COMPONENT-API-AND-VARIABLE-PLAN.md` | 颜色白名单、组件 API、变量绑定、实施顺序与验收标准 |
| `EXECUTION-RUNBOOK.md` | P0–P4 阶段、单组件 L0–L3 闭环、Integration Lab 和自动调整权限 |
| `ADAPTIVE-VISUAL-QA-PROMPT.md` | 可随时调用的视觉审查、自动修正和回归巡检 Prompt |
| `TASK-GOAL-PROMPT.md` | 主 Goal、续跑、单阶段和只做 Review Prompt |
| `FORMAL-ASSET-API-MANIFEST.md` | 61 个正式 Component / Pattern 根的精确 Node ID、完整名称、API 指纹和 drift 门禁 |
| `FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md` | Figma 正式资产到 Token、React API、响应、A11y 和验收的强制合同 |
| `FRONTEND-REFACTOR-EXECUTION-PROMPT.md` | 未来 React 垂直切片重构、Playwright 视图闭环和自动回修 Prompt |
| `STATUS.md` | 当前执行指针、Node ID、L0–L3 证据和变更台账 |

## 当前阶段

- `P0-P4.d`：Figma Foundations、Component、Page Pattern 与 Final QA 全部 `VERIFIED`。
- `P4.e`：Figma-to-React 实施合同、未来前端执行 Prompt 与 Token Code Syntax 审计全部 `VERIFIED`。
- 正式资产发现必须使用 `FORMAL-ASSET-API-MANIFEST.md` 的精确 allowlist；禁止只按名称前缀匹配历史同名资产。
- 实时交付基线：201 个本地 Variables，其中 9 个正式集合共 176 个正式 Variables，Legacy `Collection 1` 25 个；61 个正式公开 Component / Pattern 根；10 个 Text Styles；5 个 Effect Styles。
- 正式 Variables 的 WEB Code Syntax：176/176 合法；缺失、非法格式、同集合重复均为 0。
- 实施入口：Linear [YAN-11](https://linear.app/yangdi/issue/YAN-11/实施-figma-neutral-m0token-pipeline-与视觉验证基线) 已启动 M0 Token pipeline；组件和页面重构仍未授权。执行时使用 `FRONTEND-REFACTOR-EXECUTION-PROMPT.md`，且不得用当前前端显色定义新设计。
