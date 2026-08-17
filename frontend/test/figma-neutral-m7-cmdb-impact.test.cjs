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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/impact/[instanceId]/page.tsx')
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
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {} }), useParams: () => ({ instanceId: '11' }) }
    if (request === 'next/link') return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') return { post: async () => ({ data: { data: {} } }) }
    if (request === '@/lib/api-error') return { getApiErrorMessage: (_err, fallback) => fallback, isAxiosError: () => false }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: () => ({
          data: {
            rootId: 11, rootName: 'web-01', rootModelId: 'server', direction: 'bidirectional', maxDepth: 3, truncated: false,
            layers: [
              { depth: 0, nodes: [{ id: 11, name: 'web-01', modelId: 'server', modelName: '主机' }] },
              { depth: 1, nodes: [
                { id: 12, name: '数据库-01', modelId: 'database', modelName: '数据库', status: 'running', businessLevel: 'core' },
                { id: 13, name: '交换机-01', modelId: 'switch', modelName: '交换机', status: 'maintenance' },
              ] },
            ],
            edges: [{ src: 11, dst: 12, kind: 'depends_on', label: '依赖' }, { src: 11, dst: 13, kind: 'connects' }],
          },
          isLoading: false, isError: false, refetch() {},
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

test('cmdb impact keeps contracts and uses the compact hierarchy composition', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /\['cmdb-impact', instanceId, direction, maxDepth\]/)
  assert.match(page, /api.post\(`\/cmdb\/instances\/\$\{instanceId\}\/impact`/)
  assert.match(page, /DashboardFeedbackPage className="cwgsyw-cmdb-page cwgsyw-cmdb-impact"/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.match(page, /aria-label="影响方向"/)
  assert.match(page, /aria-label="影响深度"/)
  assert.match(page, /size="sm"[\s\S]*variant="secondary"[\s\S]*返回实例/)
  assert.match(page, /!isHydrated[\s\S]*!canAnalyze[\s\S]*无权查看影响分析/)
  assert.match(page, /affectedNodeCount === 0/)
  assert.match(page, /title="暂无受影响节点"/)
  assert.match(page, /aria-expanded=\{!isCollapsed\}/)
  assert.match(page, /aria-controls=\{panelId\}/)
  assert.match(page, /onClick=\{\(\) => toggleCollapse\(layer\.depth\)\}/)
  assert.match(page, /<MotionConfig reducedMotion="user">/)
  assert.match(page, /<AnimatePresence initial=\{false\}>/)
  assert.match(patterns, /\.cwgsyw-cmdb-impact__layer-panel \{[\s\S]*overflow: hidden/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /border-primary|bg-primary|lucide-react/)
  assert.doesNotMatch(page, /\bBreadcrumb\b/)
  assert.doesNotMatch(page, /cwgsyw-stack-list/)
})

test('cmdb impact renders Neutral analysis', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /影响分析/)
  assert.match(html, /web-01/)
  assert.match(html, /主机/)
  assert.doesNotMatch(html, />server</)
  assert.match(html, /影响节点 2 个 · 关联 2 条/)
  assert.match(html, /第 1 层 · 关联 · 2 个节点/)
  assert.match(html, /aria-expanded="true"/)
})

test('cmdb impact layers expand downward with reduced-motion-aware height animation', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /initial=\{\{ height: 0, opacity: 0 \}\}/)
  assert.match(page, /animate=\{\{ height: 'auto', opacity: 1 \}\}/)
  assert.match(page, /exit=\{\{ height: 0, opacity: 0 \}\}/)
  assert.match(page, /transition=\{\{ duration: 0\.22, ease: \[0\.4, 0, 0\.2, 1\] \}\}/)
  assert.doesNotMatch(page, /NeutralDrawer|selectedDepth/)
})

test('cmdb impact uses the enriched root model name and the shared model badge typography', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')
  assert.match(page, /const rootModelName = rootNode\?\.modelName\?\.trim\(\) \|\| data\?\.rootModelId/)
  assert.match(page, /headerAction=\{rootModelName \? <Badge label=\{rootModelName\} \/> : null\}/)
  assert.match(patterns, /\.cwgsyw-cmdb-impact__root :where\(\.cwgsyw-type-body-sm, \.cwgsyw-badge\),/)
})

test('cmdb impact keeps status, model and relation badges in one metadata row', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')
  assert.match(page, /headerAction=\{[\s\S]*cwgsyw-cmdb-impact__meta[\s\S]*edgeSummaries\.map/)
  assert.match(patterns, /\.cwgsyw-cmdb-impact__meta \{[\s\S]*flex-wrap: wrap/)
  assert.doesNotMatch(page, /cwgsyw-cmdb-impact__relations/)
})

test('cmdb impact only assigns immediate-layer edges and groups repeated relation labels', () => {
  const page = loadCompiled(pagePath)
  const layers = [
    { depth: 0, nodes: [{ id: 1 }] },
    { depth: 1, nodes: [{ id: 2 }, { id: 3 }, { id: 4 }] },
    { depth: 2, nodes: [{ id: 5 }] },
  ]
  const edges = [
    { src: 2, dst: 5, kind: 'rack-host', label: '主线拓扑' },
    { src: 3, dst: 5, kind: 'room-host', label: '主线拓扑' },
    { src: 4, dst: 5, kind: 'pool-host', label: '主线拓扑' },
    { src: 1, dst: 5, kind: 'cross-layer', label: '跨层关系' },
  ]
  const incoming = page.buildImmediateIncomingEdges(layers, edges)
  assert.equal(incoming.get(5).length, 3)
  assert.deepEqual(page.summarizeImpactEdges(incoming.get(5)), [{ label: '主线拓扑', count: 3 }])
})
