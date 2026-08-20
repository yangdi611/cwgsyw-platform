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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/instances/2d-view/page.tsx')
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
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {} }) }
    if (request === 'next/link') return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') return { get: async () => ({ data: { data: { records: [] } } }) }
    if (request === '@/lib/api-error') return { getApiErrorMessage: (_err, fallback) => fallback, isAxiosError: () => false }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: ({ queryKey } = {}) => {
          if (queryKey?.[0] === 'cmdb-models-all') return { data: [{ modelId: 'server', displayName: '服务器' }] }
          return { data: undefined, isLoading: false, isError: false, refetch() {} }
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

test('cmdb 2d view uses one shell breadcrumb and compact accessible controls', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /cmdb-2d-view/)
  assert.match(page, /\/cmdb\/instances\/2d-view/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /lucide-react/)
  assert.match(page, /className="cwgsyw-cmdb-page cwgsyw-cmdb-2d-view"/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.doesNotMatch(page, /\bBreadcrumb\b/)
  assert.match(page, /aria-label="选择模型"/)
  assert.match(page, /aria-label="选择分组字段"/)
  assert.match(page, /size="sm"/)
  assert.match(page, /overlay/)
})

test('cmdb 2d view separates query, permission, empty and grouped board states', () => {
  const pageSource = fs.readFileSync(pagePath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')
  assert.match(pageSource, /isHydrated/)
  assert.match(pageSource, /无权查看 2D 视图/)
  assert.match(pageSource, /模型加载失败/)
  assert.match(pageSource, /分组字段加载失败/)
  assert.match(pageSource, /暂无可分组字段/)
  assert.match(pageSource, /暂无实例数据/)
  assert.match(pageSource, /cwgsyw-cmdb-2d-view__group-grid/)
  assert.match(pageSource, /cwgsyw-cmdb-2d-view__instance/)
  assert.doesNotMatch(pageSource, /<Card\b/)
  assert.doesNotMatch(pageSource, /cwgsyw-stack-list/)
  assert.match(pageSource, /value=\{effectiveGroupBy\}/)
  assert.match(patterns, /\.cwgsyw-cmdb-2d-view__group-grid\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/s)
  assert.match(patterns, /@media \(max-width: 1100px\)[\s\S]*?\.cwgsyw-cmdb-2d-view__group-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(patterns, /@media \(max-width: 520px\)[\s\S]*?\.cwgsyw-cmdb-2d-view__group-grid\s*\{[^}]*minmax\(0, 1fr\)/)

  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /2D 视图/)
  assert.match(html, /请选择一个模型/)
  assert.match(html, /选择模型和分组字段后查看实例分布/)
})
