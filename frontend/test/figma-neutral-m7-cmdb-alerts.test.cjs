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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/alerts/page.tsx')
const alertIconPath = path.join(frontendRoot, 'public/figma-icons/cmdb-alert-circle.svg')
const patternsPath = path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css')

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
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {}, back() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePrometheusAlerts') return { useAcknowledgeAlert: () => ({ mutate() {}, isPending: false }) }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') {
      return {
        get: async () => ({ data: { data: { records: [{ id: '1', name: '变更审批流', key: 'changeDocApproval', version: 2, category: '审批', activeVersion: 2 }], total: 1 } } }),
        put: async () => ({ data: {} }),
        post: async () => ({ data: {} }),
        delete: async () => ({ data: {} }),
      }
    }
    if (request === '@/lib/api-error') return { getApiErrorMessage: (_err, fallback) => fallback }
    if (request === '@/types/api') {
      return { extractPaginated: (r) => r.data.data }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: () => ({
          data: { records: [{ id: 9, ciInstanceId: 1, ciInstanceName: 'web-01', alertName: 'CPU 过高', severity: 'critical', status: 'firing', summary: 'cpu', description: '', startsAt: '2026-08-14T00:00:00Z', endsAt: null, acknowledged: false, createdAt: '2026-08-14T00:00:00Z' }], total: 1 },
          isLoading: false,
          isFetching: false,
          isError: false,
          refetch() {},
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

test('cmdb alerts uses the scoped accessible data-management composition', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['cmdb-alerts', severity, status, page\]/)
  assert.match(page, /\/cmdb\/alerts/)
  assert.match(page, /hasPermission\('cmdb_alert', 'read'\)/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.match(page, /DataManagementPage className="cwgsyw-cmdb-page cwgsyw-cmdb-alerts"/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.doesNotMatch(page, /<Breadcrumb/)
  assert.doesNotMatch(page, /if \(!canRead\) return null/)
  assert.match(page, /aria-label="按告警级别筛选"/)
  assert.match(page, /aria-label="按告警状态筛选"/)
  assert.match(page, /cwgsyw-cmdb-alerts__mobile-list/)
  assert.match(page, /无权查看告警中心/)
  assert.match(page, /加载告警记录/)
  assert.match(page, /告警加载失败/)
  assert.match(page, /没有符合筛选条件的告警/)
  assert.match(page, /tone: 'info', label: '提示'/)
})

test('cmdb alerts uses the official Figma alert-circle asset', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const asset = fs.readFileSync(alertIconPath, 'utf8')
  assert.match(page, /Figma CWGSYW \/ Icons: alert-circle, node 6:22984/)
  assert.match(page, /\/figma-icons\/cmdb-alert-circle\.svg/)
  assert.match(asset, /viewBox="0 0 22 22"/)
  assert.match(asset, /id="Union"/)
})

test('cmdb alerts keeps the desktop table and a native compact mobile card layout', () => {
  const css = fs.readFileSync(patternsPath, 'utf8')
  assert.match(css, /\.cwgsyw-cmdb-alerts__table \.cwgsyw-table \{[\s\S]*?min-width: 920px;[\s\S]*?table-layout: fixed;/)
  assert.match(css, /\.cwgsyw-cmdb-alerts__mobile-list \{[\s\S]*?display: grid;/)
  assert.match(css, /\.cwgsyw-cmdb-alerts__mobile-item dl \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
})

test('cmdb alerts renders Neutral table', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /告警中心/)
  assert.match(html, /CPU 过高/)
  assert.match(html, /确认告警 CPU 过高/)
  assert.match(html, /告警记录/)
  assert.equal((html.match(/aria-label="面包屑"/g) ?? []).length, 0)
})
