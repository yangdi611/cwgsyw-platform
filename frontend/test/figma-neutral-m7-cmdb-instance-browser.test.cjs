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
const pagePath = path.join(frontendRoot, 'src/components/cmdb/InstanceBrowserSection.tsx')

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
          if (key.includes('cmdb-models-all')) {
            return { data: [{ modelId: 'server', name: '服务器', displayName: '服务器', attributes: [] }] }
          }
          return {
            data: { records: [{ id: 11, name: 'web-01', modelId: 'server', modelName: '服务器', status: 'running', owner: 'ops', description: '', fieldsData: {}, createdAt: '2026-08-14T00:00:00Z', updatedAt: '2026-08-14T00:00:00Z' }] },
            isLoading: false,
            refetch() {},
          }
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

test('cmdb instance browser leaves old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['cmdb-overview-instance-browser', model, keyword, status\]/)
  assert.match(page, /\/cmdb\/instances/)
  assert.match(page, /cwgsyw-instance-browser__filters/)
  assert.match(page, /overlay/)
  assert.match(page, /size="sm"/)
  assert.match(page, /重置筛选/)
  assert.match(page, /CmdbInstancePreview/)
  assert.match(page, /cwgsyw-cmdb-preview-drawer/)
  assert.match(page, /cwgsyw-cmdb-table/)
  assert.doesNotMatch(page, /refetch/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /border-v2-/)
})

test('cmdb instance browser renders Neutral table', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /实例浏览/)
  assert.match(html, /web-01/)
})

test('cmdb instance browser separates the header from table rows', () => {
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  const header = css.slice(css.indexOf('.cwgsyw-instance-browser__table .cwgsyw-th {'), css.indexOf('.cwgsyw-instance-browser__table .cwgsyw-td'))
  assert.match(header, /border-bottom: var\(--cwgsyw-border-width-default\) solid var\(--cwgsyw-border-default\)/)
  assert.match(css, /\.cwgsyw-instance-browser__table \.cwgsyw-tr\[data-state="default"\]:hover \.cwgsyw-td \{\n    background: var\(--cwgsyw-bg-surface-subtle\);/)
  assert.match(css, /\.cwgsyw-instance-browser__table \.cwgsyw-tr:last-child \.cwgsyw-td \{ border-bottom: 0; \}/)
})

test('cmdb instance preview drawer stays compact', () => {
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(css, /\.cwgsyw-drawer\.cwgsyw-cmdb-preview-drawer \{/)
  assert.match(css, /\.cwgsyw-cmdb-preview__row dt \{ color: var\(--cwgsyw-text-tertiary\); \}/)
  assert.match(css, /font-weight: var\(--cwgsyw-font-weight-regular\)/)
})

test('cmdb instance preview drawer inherits the shared Vaul right-side motion', () => {
  const overlay = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/Overlay.tsx'), 'utf8')
  const drawer = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/Drawer.tsx'), 'utf8')
  const patterns = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(overlay, /<Drawer open=\{open\} onOpenChange=\{onOpenChange\} direction=\{side\}>/)
  assert.match(drawer, /from 'vaul'/)
  assert.doesNotMatch(patterns, /cwgsyw-cmdb-preview-drawer\[data-starting-style\]/)
})
