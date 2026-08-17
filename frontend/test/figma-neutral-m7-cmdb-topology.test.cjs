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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/topology/[instanceId]/page.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {} }), useParams: () => ({ instanceId: '11' }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === 'html-to-image') return { toPng: async () => 'data:image/png;base64,xx' }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') return { get: async () => ({ data: { data: { nodes: [], edges: [] } } }) }
    if (request === '@/components/cmdb/CiTopologyGraph') {
      return { CiTopologyGraph: React.forwardRef(() => React.createElement('div', null, 'graph')) }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: ({ queryKey } = {}) => {
          if (queryKey?.[0] === 'cmdb-topology') {
            return {
              data: {
                nodes: [
                  { id: 11, name: 'web-01', modelId: 'server', modelName: '服务器', status: 'online', isRoot: true },
                  { id: 12, name: 'db-01', modelId: 'database', modelName: '数据库', status: 'maintenance', isRoot: false },
                ],
                edges: [{ src: 11, dst: 12, kind: 'depends_on', label: '依赖' }],
              },
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          return { data: undefined, isLoading: false, isError: false }
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

test('cmdb topology leaves old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /\['cmdb-topology', instanceId, depth\]/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /lucide-react/)
  assert.doesNotMatch(page, /bg-amber-/)
  assert.doesNotMatch(page, /<Breadcrumb/)
  assert.doesNotMatch(page, /<Card/)
  assert.doesNotMatch(page, /cwgsyw-stack-list/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.match(page, /cwgsyw-cmdb-topology__workspace/)
  assert.match(page, /cwgsyw-cmdb-topology__side-panel/)
  assert.match(page, /cwgsyw-cmdb-topology__definition-list/)
  assert.match(page, /PaginationPageItem/)
  assert.match(page, /label=\{`查看 \$\{d\} 层拓扑`\}/)
  assert.doesNotMatch(page, /<Chip/)
  assert.match(page, /全屏查看/)
  assert.match(page, /event\.key === 'Escape'/)
  assert.doesNotMatch(page, /return \{ nodes: \[\], edges: \[\] \}/)
  assert.match(page, /modelId: node\.modelId \?\? node\.model_id \?\? null/)
  assert.match(page, /isRoot: node\.isRoot \?\? node\.is_root \?\? false/)
  assert.match(page, /keyAttrs: node\.keyAttrs \?\? node\.key_attrs \?\? null/)
})

test('cmdb topology renders Neutral chrome around graph', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /拓扑图/)
  assert.match(html, /web-01/)
  assert.match(html, /导出 PNG/)
  assert.match(html, /拓扑画布/)
  assert.match(html, /全屏查看/)
  assert.match(html, /筛选与详情/)
  assert.match(html, /模型类型/)
  assert.match(html, /拓扑节点 2 个 · 关联 1 条/)
})

test('cmdb topology keeps compact responsive canvas and local fullscreen surface', () => {
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(css, /\.cwgsyw-cmdb-topology__canvas \{[\s\S]*?height: 520px/)
  assert.match(css, /\.cwgsyw-cmdb-topology__workspace\.is-fullscreen \{[\s\S]*?position: fixed/)
  assert.match(css, /@media \(max-width: 1100px\) \{[\s\S]*?cwgsyw-cmdb-topology > \.cwgsyw-page__grid[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(css, /@media \(max-width: 520px\) \{[\s\S]*?\.cwgsyw-cmdb-topology__canvas \{ height: 360px; \}/)
  assert.match(css, /\.cwgsyw-cmdb-topology__filter-group h3 \{[^}]*font-size: var\(--cwgsyw-font-size-label-sm\);[^}]*font-weight: var\(--cwgsyw-font-weight-regular\);/)
  assert.match(css, /\.cwgsyw-cmdb-topology__filter-group \.cwgsyw-choice \{[^}]*min-height: 28px;[^}]*gap: var\(--cwgsyw-space-2\);/)
  assert.match(css, /\.cwgsyw-cmdb-topology__filter-group \.cwgsyw-choice input \{[^}]*width: 16px;[^}]*height: 16px;/)
  assert.match(css, /\.cwgsyw-cmdb-topology__filter-group \.cwgsyw-choice \.cwgsyw-type-label-sm \{[^}]*font-weight: var\(--cwgsyw-font-weight-regular\);/)
  assert.match(css, /\.cwgsyw-cmdb-topology__header-actions \{[^}]*margin-inline-start: auto;/)
  assert.match(css, /\.cwgsyw-cmdb-topology__header-actions \.cwgsyw-btn \{[^}]*height: 28px;/)
  assert.match(css, /\.cwgsyw-cmdb-topology__depth-pages \{[^}]*gap: var\(--cwgsyw-space-1\);/)
})
