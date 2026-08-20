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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/page.tsx')

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
    if (request === 'next/link') return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') return { get: async () => ({ data: { data: { records: [], total: 0 } } }) }
    if (request === '@/lib/work-item-api') return { listWorkItems: async () => ({ records: [] }) }
    if (request === '@/components/ops-calendar/DashboardOpsCalendarCard') return { DashboardOpsCalendarCard: () => React.createElement('div', null, 'calendar') }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: ({ queryKey } = {}) => {
          const key = String(queryKey || '')
          const idle = { isLoading: false, isError: false, refetch() {} }
          if (key.includes('work-items')) return { data: [], ...idle }
          if (key.includes('cmdb-alerts')) return { data: { records: [], total: 0 }, ...idle }
          if (key.includes('change-docs')) return { data: [], ...idle }
          if (key.includes('cmdb-changes')) return { data: { records: [], total: 0 }, ...idle }
          if (key.includes('cmdb-models-dashboard-share')) return { data: { records: [{ modelId: 'host', name: '主机', displayName: '主机', instanceCount: 8 }, { modelId: 'mysql', name: 'MySQL实例', displayName: 'MySQL实例', instanceCount: 2 }], total: 2 }, ...idle }
          return { data: undefined, ...idle }
        },
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

test('home leaves old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /work-items-dashboard/)
  assert.match(page, /CmdbInstanceShareChart/)
  assert.doesNotMatch(page, /CmdbRelationNetworkChart/)
  assert.doesNotMatch(page, /cwgsyw-home__chart-row/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /lucide-react/)
})

test('home renders Neutral dashboard', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /工作台/)
  assert.match(html, /常用业务入口/)
  assert.match(html, /CI 实例构成/)
  assert.doesNotMatch(html, /CI 关系网/)
  assert.match(html, /cwgsyw-home/)
  assert.match(html, /figma-icons\/home-clipboard-check\.svg/)
  assert.doesNotMatch(html, /Operations Command Center/)
})

test('home composes quick links as Dashboard Tiles instead of nested list containers', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(page, /cwgsyw-dashboard-link-list/)
  assert.match(page, /cwgsyw-dashboard-tile__copy/)
  assert.doesNotMatch(page, /<Link key=\{link\.title\} href=\{link\.href\} className="cwgsyw-stack-list">/)
  assert.match(css, /\.cwgsyw-dashboard-link-list \{ display: grid/)
  assert.match(css, /\.cwgsyw-dashboard-tile__copy \{ display: grid/)
})

test('home follows Neutral baseline density and Figma empty icons', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  const calendar = fs.readFileSync(path.join(frontendRoot, 'src/components/ops-calendar/DashboardOpsCalendarCard.tsx'), 'utf8')
  assert.match(page, /className="cwgsyw-home"/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.match(page, /showEyebrow=\{false\}/)
  assert.match(page, /size="sm"/)
  assert.match(page, /figma-icons\/home-clipboard-check\.svg/)
  assert.match(page, /6:24460/)
  assert.match(calendar, /figma-icons\/home-calendar\.svg/)
  assert.match(calendar, /6:24162/)
  assert.match(calendar, /cwgsyw-cmdb-table/)
  assert.match(calendar, /StatusBadge size="sm"/)
  assert.match(css, /\.cwgsyw-home \.cwgsyw-page-header__row > h1/)
  assert.match(css, /\.cwgsyw-home__actions/)
  assert.ok(fs.existsSync(path.join(frontendRoot, 'public/figma-icons/home-clipboard-check.svg')))
  assert.ok(fs.existsSync(path.join(frontendRoot, 'public/figma-icons/home-calendar.svg')))
  const clipboard = fs.readFileSync(path.join(frontendRoot, 'public/figma-icons/home-clipboard-check.svg'), 'utf8')
  const cal = fs.readFileSync(path.join(frontendRoot, 'public/figma-icons/home-calendar.svg'), 'utf8')
  assert.match(clipboard, /<svg[\s\S]*<path id="Union"/)
  assert.match(cal, /<svg[\s\S]*<path id="Union"/)
  assert.doesNotMatch(clipboard, /#F5F5F5/)
  assert.doesNotMatch(cal, /#F5F5F5/)
})
