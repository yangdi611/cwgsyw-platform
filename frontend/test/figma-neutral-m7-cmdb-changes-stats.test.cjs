'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const frontendRoot = path.resolve(__dirname, '..')
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/changes/stats/page.tsx')

function compile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  }).outputText
}

function loadCompiled(filePath) {
  const compiled = compile(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {} }) }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') return { get: async () => ({ data: { data: {} } }) }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: () => ({
          data: {
            today: { created: 1, updated: 2, deleted: 0, total: 3 },
            thisWeek: { created: 1, updated: 2, deleted: 0, total: 3 },
            thisMonth: { created: 1, updated: 2, deleted: 0, total: 3 },
            dailyBreakdown: [{ date: '2026-08-14', created: 1, updated: 2, deleted: 0 }],
            top10Instances: [{ instanceId: 11, instanceName: 'web-01', modelId: 'server', modelName: '服务器', changeCount: 4 }],
          },
          isLoading: false,
        }),
      }
    }
    if (request.startsWith('@base-ui/react/')) {
      const passthrough = ({ children }) => React.createElement(React.Fragment, null, children)
      const node = ({ children, className, ...props }) => React.createElement('div', { className, ...props }, children)
      return {
        Dialog: { Root: passthrough, Portal: passthrough, Backdrop: node, Popup: node, Title: node, Description: node, Close: node },
        Menu: { Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
        Popover: { Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
        Tooltip: { Provider: passthrough, Root: passthrough, Trigger: node, Portal: passthrough, Positioner: passthrough, Popup: node },
      }
    }
    if (request.startsWith('@/')) {
      const resolved = path.join(frontendRoot, 'src', request.slice(2))
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit) return loadCompiled(hit)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit)
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  const mod = new Module(filePath, module)
  mod.filename = filePath
  mod.paths = Module._nodeModulePaths(path.dirname(filePath))
  try { mod._compile(compiled, filePath) } finally { Module._load = originalLoad }
  return mod.exports
}

test('cmdb changes stats uses a scoped Dashboard Feedback composition', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /cmdb-changes-stats/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-|bg-v2-primary/)
  assert.match(page, /DashboardFeedbackPage className="cwgsyw-cmdb-page cwgsyw-cmdb-change-stats"/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.doesNotMatch(page, /<Breadcrumb/)
  assert.doesNotMatch(page, /cwgsyw-stack-list/)
  assert.doesNotMatch(page, /style=\{\{/)
  assert.match(page, /cwgsyw-cmdb-change-stats__feedback/)
  assert.match(page, /cwgsyw-cmdb-change-stats__chart/)
})

test('cmdb changes stats exposes range, permission and query states', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /aria-label="统计日期范围"/)
  assert.match(page, /aria-label="开始日期"/)
  assert.match(page, /aria-label="结束日期"/)
  assert.match(page, /无权查看变更统计/)
  assert.match(page, /日期范围无效/)
  assert.match(page, /变更统计加载失败/)
  assert.match(page, /所选范围内还没有可汇总的每日记录/)
  assert.match(page, /所选范围内没有可排名的实例记录/)
})

test('cmdb changes stats renders Neutral metrics', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /变更统计/)
  assert.match(html, /web-01/)
  assert.match(html, /每日新增、修改和删除变更趋势/)
  assert.match(html, /返回变更历史/)
  assert.equal((html.match(/aria-label="面包屑"/g) ?? []).length, 0)
})
