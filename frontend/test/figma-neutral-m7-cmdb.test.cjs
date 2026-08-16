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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/page.tsx')

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
    if (request === '@/components/cmdb/InstanceBrowserSection') return { __esModule: true, default: () => null }
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
        useQuery: ({ queryKey } = {}) => {
          const key = String(queryKey || '')
          if (key.includes('cmdb-model-groups')) return { data: [{ code: 'hardware', name: '硬件', sortOrder: 1 }] }
          if (key.includes('cmdb-models')) return { data: { records: [{ modelId: 'server', name: '服务器', displayName: '服务器', group: 'hardware', groupName: '硬件', instanceCount: 3, attributes: [1, 2] }], total: 1 } }
          return { data: undefined, isLoading: false }
        },
      }
    }
    if (request === 'motion/react') {
      const motion = new Proxy({}, {
        get: (_target, tag) => ({ children, layoutId, transition, initial, animate, exit, ...props }) => React.createElement(tag, props, children),
      })
      const passthrough = ({ children }) => React.createElement(React.Fragment, null, children)
      return { AnimatePresence: passthrough, MotionConfig: passthrough, motion }
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

test('cmdb overview leaves colored catalog and old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['cmdb-models-overview'\]/)
  assert.match(page, /queryKey: \['cmdb-model-groups-overview'\]/)
  assert.match(page, /InstanceBrowserSection/)
  assert.match(page, /<h1 className="sr-only">CMDB<\/h1>/)
  assert.match(page, /cwgsyw-cmdb-overview__catalog-note/)
  assert.match(page, /name="chevron-next"[\s\S]*按模型组分类浏览资产目录。[\s\S]*name="chevron-previous"/)
  assert.match(page, /cwgsyw-cmdb-overview__model-tile/)
  assert.match(page, /cwgsyw-cmdb-overview__group-tab/)
  assert.match(page, /MotionConfig reducedMotion="user"/)
  assert.match(page, /motion\.span/)
  assert.match(page, /cwgsyw-cmdb-overview__model-track/)
  assert.match(page, /activeGroupIndex \* -100/)
  assert.match(page, /stiffness: 180, damping: 26/)
  assert.doesNotMatch(page, /AnimatePresence/)
  assert.match(page, /layoutId="cmdb-model-group-indicator"/)
  assert.match(page, /role="tab"/)
  assert.doesNotMatch(page, /DashboardFeedbackPage/)
  assert.doesNotMatch(page, /MetricCard/)
  assert.doesNotMatch(page, /title="概览"/)
  assert.doesNotMatch(page, /GROUP_PALETTES/)
  assert.doesNotMatch(page, /#2563eb/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared\/PageHeader/)
  assert.doesNotMatch(page, /text-v2-/)
})

test('CMDB model-group tabs match the Figma compact rail', () => {
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  const rail = css.slice(css.indexOf('.cwgsyw-cmdb-overview__groups {'), css.indexOf('.cwgsyw-cmdb-overview__model-grid {'))
  assert.match(rail, /min-height: 40px/)
  assert.match(rail, /width: fit-content/)
  assert.match(rail, /justify-self: start/)
  assert.match(rail, /padding: 6px/)
  assert.match(rail, /background: var\(--cwgsyw-bg-surface-subtle\)/)
  assert.match(rail, /width: auto/)
  assert.match(rail, /min-width: 64px/)
  assert.match(rail, /min-height: 28px/)
  assert.match(rail, /padding: 4px 10px/)
  assert.match(rail, /color: var\(--cwgsyw-text-secondary\)/)
  assert.match(rail, /font-size: var\(--cwgsyw-font-size-body-xs\)/)
  assert.match(rail, /font-weight: var\(--cwgsyw-font-weight-regular\)/)
  assert.match(rail, /box-shadow: 0 1px 2px rgb\(0 0 0 \/ 0\.05\)/)
  assert.match(rail, /transition: background-color 160ms ease, color 160ms ease, transform 160ms ease/)
  assert.match(rail, /transform: translateY\(-1px\)/)
  assert.match(rail, /group-motion-indicator/)
  assert.match(rail, /group-tab-label/)
})

test('CMDB overview keeps card and table hierarchy calm', () => {
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  const catalog = css.slice(css.indexOf('.cwgsyw-cmdb-overview__model-panels {'), css.indexOf('@media (max-width: 860px)'))
  assert.match(catalog, /overflow: hidden/)
  assert.match(catalog, /display: flex/)
  assert.match(catalog, /min-width: 100%/)
  assert.match(catalog, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(catalog, /min-height: 76px/)
  assert.match(catalog, /justify-items: start/)
  assert.match(catalog, /font-size: 13px/)
  assert.match(catalog, /font-weight: var\(--cwgsyw-font-weight-medium\)/)
  assert.match(catalog, /color: var\(--cwgsyw-text-tertiary\)/)
  assert.match(catalog, /font-weight: var\(--cwgsyw-font-weight-regular\)/)
  assert.match(catalog, /border: var\(--cwgsyw-border-width-default\) solid var\(--cwgsyw-border-subtle\)/)
  assert.match(catalog, /border-color: var\(--cwgsyw-border-default\)/)
  assert.match(catalog, /background: var\(--cwgsyw-bg-surface-subtle\)/)
  assert.doesNotMatch(catalog, /font-weight: var\(--cwgsyw-font-weight-bold\)/)
})

test('CMDB catalog description stays inline and low emphasis', () => {
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  const note = css.slice(css.indexOf('.cwgsyw-cmdb-overview__catalog-note {'), css.indexOf('.cwgsyw-cmdb-overview__section-heading p,'))
  assert.match(note, /display: inline-flex/)
  assert.match(note, /color: var\(--cwgsyw-text-secondary\)/)
  assert.match(note, /font-size: var\(--cwgsyw-font-size-label-sm\)/)
  assert.match(note, /font-weight: var\(--cwgsyw-font-weight-regular\)/)
})

test('CMDB overview separates the model catalog and instance browser', () => {
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(css, /\.cwgsyw-cmdb-overview \{ gap: var\(--cwgsyw-space-10\); \}/)
  assert.doesNotMatch(css, /\.cwgsyw-instance-browser \{\n  padding-top:/)
  assert.doesNotMatch(css, /padding-top: var\(--cwgsyw-space-4\);\n  border-top: var\(--cwgsyw-border-width-default\) solid var\(--cwgsyw-border-subtle\);/)
})

test('CMDB instance filters use compact type in their Select controls and menus', () => {
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  const filters = css.slice(css.indexOf('.cwgsyw-instance-browser__filters {'), css.indexOf('.cwgsyw-instance-browser__table'))
  assert.match(filters, /\.cwgsyw-select \.cwgsyw-control/)
  assert.match(filters, /\.cwgsyw-instance-browser__search \.cwgsyw-control/)
  assert.match(filters, /\.cwgsyw-listbox button/)
  assert.match(filters, /font-size: var\(--cwgsyw-font-size-label-sm\)/)
  assert.match(filters, /line-height: var\(--cwgsyw-type-label-sm-line-height\)/)
})

test('cmdb overview renders Neutral catalog', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /CMDB/)
  assert.doesNotMatch(html, /概览/)
  assert.match(html, /各类模型/)
})
