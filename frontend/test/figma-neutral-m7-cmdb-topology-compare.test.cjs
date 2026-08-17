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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/topology/[instanceId]/compare/page.tsx')
const graphPath = path.join(frontendRoot, 'src/components/cmdb/CiTopologyGraph.tsx')

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
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') return { get: async () => ({ data: { data: {} } }) }
    if (request === '@/components/cmdb/CiTopologyGraph') return { CiTopologyGraph: () => React.createElement('div', null, 'graph') }
    if (request === '@tanstack/react-query') return {
      useQuery: () => ({
        data: {
          added: [{ id: 11, name: 'web-01', model_id: 'server', model_name: '服务器', status: 'online', is_root: true, key_attrs: { env: 'prod' } }],
          removed: [],
          modified: [{ id: 12, name: 'db-01', model_id: 'database', model_name: '数据库', status: 'maintenance', is_root: false }],
          unchanged: [{ id: 13, name: 'switch-01', model_id: 'switch', model_name: '交换机', status: 'online', is_root: false }],
          edges: [{ src: 11, dst: 12, kind: 'depends_on', label: '依赖', status: 'modified' }],
        },
        isFetching: false,
        isError: false,
        refetch() {},
      }),
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

test('cmdb topology compare leaves old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /cmdb-topology-compare/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /bg-green-|bg-red-|bg-amber-|bg-slate-/)
  assert.doesNotMatch(page, /<Breadcrumb/)
  assert.doesNotMatch(page, /cwgsyw-stack-list/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.match(page, /cwgsyw-cmdb-topology-compare__form/)
  assert.match(page, /cwgsyw-cmdb-topology-compare__summary/)
  assert.match(page, /cwgsyw-cmdb-topology-compare__workspace/)
  assert.match(page, /截止时间不能早于起始时间/)
  assert.match(page, /modelId: n\.modelId \?\? n\.model_id \?\? null/)
  assert.match(page, /isRoot: n\.isRoot \?\? n\.is_root \?\? false/)
})

test('cmdb topology compare renders Neutral prompt', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /拓扑对比/)
  assert.match(html, /开始对比/)
  assert.match(html, /web-01 的拓扑对比/)
  assert.match(html, /差异摘要/)
  assert.match(html, /新增 1/)
  assert.match(html, /修改 1/)
  assert.match(html, /差异拓扑画布/)
})

test('cmdb topology compare keeps compact responsive filters and canvas', () => {
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(css, /\.cwgsyw-cmdb-topology-compare__form \{[\s\S]*?grid-template-columns: minmax\(200px, 1fr\) minmax\(200px, 1fr\) 112px auto/)
  assert.match(css, /\.cwgsyw-cmdb-topology-compare__canvas \{[\s\S]*?height: 520px/)
  assert.match(css, /@media \(max-width: 1100px\) \{[\s\S]*?\.cwgsyw-cmdb-topology-compare__canvas \{ height: 440px; \}/)
  assert.match(css, /@media \(max-width: 520px\) \{[\s\S]*?\.cwgsyw-cmdb-topology-compare__canvas \{ height: 360px; \}/)
})

test('shared CMDB topology graph uses the compact Neutral dotted canvas recipe', () => {
  const graph = fs.readFileSync(graphPath, 'utf8')
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(graph, /className="cwgsyw-topology-graph"/)
  assert.match(graph, /<Background color="var\(--cwgsyw-border-strong\)" gap=\{18\} size=\{1\}/)
  assert.match(graph, /cwgsyw-topology-node__frame/)
  assert.match(graph, /cwgsyw-topology-node-popover/)
  assert.match(graph, /NodeToolbar/)
  assert.match(graph, /AnimatePresence, motion, useReducedMotion/)
  assert.match(graph, /COLLAPSED_KEY_ATTR_LIMIT = 6/)
  assert.match(graph, /EXPANDED_POPOVER_WIDTH = 376/)
  assert.match(graph, /查看全部（\$\{keyAttrEntries\.length\}）/)
  assert.match(graph, /aria-expanded=\{isExpanded\}/)
  assert.match(graph, /prefersReducedMotion \? \{ duration: 0 \}/)
  assert.match(graph, /isVisible=\{visible\}/)
  assert.match(graph, /position=\{Position\.Bottom\}/)
  assert.match(graph, /align="start"/)
  assert.match(graph, /colorMode="light"/)
  assert.match(graph, /fitViewOptions=\{\{ padding: 0\.35, maxZoom: 1 \}\}/)
  assert.match(graph, /maxZoom=\{1\.5\}/)
  assert.doesNotMatch(graph, /boxShadow: d\.isRoot/)
  assert.match(css, /\.cwgsyw-topology-node__frame \{[\s\S]*?min-width: 96px;[\s\S]*?max-width: 132px;[\s\S]*?padding: 4px 6px;/)
  assert.match(graph, /border: 'var\(--cwgsyw-border-width-default\) solid var\(--cwgsyw-border-subtle\)'/)
  assert.match(graph, /'--cwgsyw-topology-node-accent': borderColor/)
  assert.match(css, /\.cwgsyw-topology-node__frame::before \{[\s\S]*?width: 2px;[\s\S]*?background: var\(--cwgsyw-topology-node-accent/)
  assert.match(css, /\.cwgsyw-topology-node:hover \.cwgsyw-topology-node__frame \{[\s\S]*?background: var\(--cwgsyw-bg-surface-hover\)/)
  assert.match(css, /\.cwgsyw-topology-node__model \{[\s\S]*?border: 0;[\s\S]*?background: transparent;/)
  assert.match(css, /\.cwgsyw-topology-node-popover \{[\s\S]*?width: 184px;[\s\S]*?overflow: visible;[\s\S]*?box-shadow: var\(--cwgsyw-elevation-sm\);[\s\S]*?pointer-events: auto;/)
  assert.match(css, /\.cwgsyw-topology-node-popover__attr-columns\.is-expanded \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/)
  assert.match(css, /\.cwgsyw-topology-node-popover__expand \{[\s\S]*?font-size: 11px;[\s\S]*?font-weight: var\(--cwgsyw-font-weight-regular\);/)
  assert.doesNotMatch(css, /\.cwgsyw-topology-node-popover \{[^}]*max-height:/)
  assert.match(graph, /hideTimerRef/)
  assert.match(graph, /setTimeout\(\(\) => \{[\s\S]*?setIsHovered\(false\)[\s\S]*?\}, 150\)/)
  assert.match(graph, /onMouseEnter=\{keepTooltipOpen\}/)
  assert.match(graph, /onMouseLeave=\{scheduleTooltipClose\}/)
  assert.match(graph, /nodrag nopan nowheel/)
  assert.match(css, /\.cwgsyw-topology-node-popover__title \{[^}]*overflow-wrap: anywhere;/)
  assert.match(css, /\.cwgsyw-topology-node-popover dd,[\s\S]*?overflow-wrap: anywhere;/)
  assert.doesNotMatch(graph, /group-hover:block/)
  assert.doesNotMatch(css, /\.cwgsyw-topology-node-popover \{[\s\S]*?top: calc\(100%/)
  assert.match(css, /\.cwgsyw-cmdb-topology-compare__legend \.cwgsyw-badge \{[\s\S]*?min-height: 18px;[\s\S]*?padding: 0 6px;[\s\S]*?font-size: 11px;[\s\S]*?line-height: 16px;/)
  assert.match(css, /\.cwgsyw-topology-graph \.react-flow__controls-button \{[\s\S]*?width: 28px;[\s\S]*?background: var\(--cwgsyw-bg-surface\);/)
  assert.match(css, /\.cwgsyw-topology-graph \.react-flow__minimap \{[\s\S]*?width: 120px;[\s\S]*?height: 72px;/)
})
