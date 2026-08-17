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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/spatial/page.tsx')
const indexPath = path.join(frontendRoot, 'src/features/cmdb-spatial/components/SpatialLayoutIndex.tsx')
const spikePath = path.join(frontendRoot, 'src/features/cmdb-spatial/spike/SpatialCanvasSpike.tsx')
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
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api-error') return { getApiErrorMessage: (_err, fallback) => fallback }
    if (request.includes('spatial-api') || request.endsWith('../api/spatial-api')) {
      return {
        spatialQueryKeys: { layouts: (v) => ['cmdb', 'spatial', 'layouts', v], rooms: () => ['cmdb', 'spatial', 'rooms'] },
        listSpatialLayouts: async () => [{ layoutId: 1, roomInstanceId: 9, name: '机房A', status: 'ACTIVE', publishedVersionId: 3 }],
        listSpatialRooms: async () => [],
        createSpatialLayout: async () => ({ roomInstanceId: 9 }),
        archiveSpatialLayout: async () => ({}),
        restoreActiveSpatialLayout: async () => ({}),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false, error: null }),
        useQuery: ({ queryKey } = {}) => {
          if (String(queryKey).includes('layouts')) return { data: [{ layoutId: 1, roomInstanceId: 9, name: '机房A', status: 'ACTIVE', publishedVersionId: 3 }], isLoading: false, isError: false }
          return { data: [], isLoading: false, isError: false }
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
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved, `${resolved}/index.ts`].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
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

test('cmdb spatial index keeps contracts and uses the compact page composition', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const index = fs.readFileSync(indexPath, 'utf8')
  const spike = fs.readFileSync(spikePath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /isHydrated/)
  assert.match(page, /无权查看空间布局/)
  assert.doesNotMatch(index, /@\/components\/design-system/)
  assert.doesNotMatch(index, /@\/components\/shared/)
  assert.doesNotMatch(index, /text-v2-|bg-v2-primary/)
  assert.doesNotMatch(index, /lucide-react/)
  assert.doesNotMatch(index, /\bBreadcrumb\b/)
  assert.match(index, /showBreadcrumb=\{false\}/)
  assert.match(index, /cwgsyw-cmdb-spatial-index__toolbar/)
  assert.match(index, /cwgsyw-cmdb-spatial-index__create-trigger/)
  assert.match(index, /cwgsyw-cmdb-spatial-index__create-dialog-form/)
  assert.match(index, /size="sm"/)
  assert.match(index, /handleCreateDialogOpenChange/)
  assert.match(index, /create\.reset\(\)/)
  assert.match(index, /<Tabs[\s\S]*?style="cmdb"[\s\S]*?size="sm"/)
  assert.match(index, /value=\{includeArchived \? 'archived' : 'active'\}/)
  assert.doesNotMatch(index, /<Chip/)
  assert.match(index, /NeutralTooltip content="归档" className="cwgsyw-tooltip--pill" followCursor/)
  assert.match(index, /cmdb-spatial-index__archive-icon/)
  assert.match(index, /router\.push\(`\/cmdb\/spatial\/rooms\/\$\{layout\.roomInstanceId\}`\)/)
  assert.match(index, /onClear=\{\(\) => setKeyword\(''\)\}/)
  assert.match(index, /cwgsyw-cmdb-spatial-index__grid/)
  assert.doesNotMatch(index, /cwgsyw-stack-list/)
  assert.match(index, /router\.push\(`\/cmdb\/spatial\/rooms\/\$\{layout\.roomInstanceId\}\/edit`\)/)
  assert.doesNotMatch(index, /window\.location\.assign/)
  assert.match(index, /空间布局加载失败/)
  assert.match(index, /机房列表加载失败/)
  assert.match(index, /没有匹配的空间布局/)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-index__grid\s*\{[^}]*repeat\(4, minmax\(0, 1fr\)\)/s)
  assert.doesNotMatch(patterns, /\.cwgsyw-cmdb-spatial-index__mode\s*\{[^}]*border:/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-index__grid \.cwgsyw-badge\s*\{[^}]*min-height:\s*18px[^}]*font-size:\s*10px/s)
  assert.match(patterns, /cmdb-spatial-archive\.svg/)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-index__archive-icon\s*\{[^}]*width:\s*17px[^}]*height:\s*14px/s)
  assert.match(patterns, /\.cwgsyw-cmdb-spatial-index \.cwgsyw-page-header__row > \.cwgsyw-cmdb-spatial-index__create-trigger\s*\{[^}]*margin-left:\s*auto/s)
  assert.match(patterns, /\.cwgsyw-dialog:has\(\.cwgsyw-cmdb-spatial-index__create-dialog-form\)\s*\{[^}]*gap:\s*var\(--cwgsyw-space-4\)[^}]*padding:\s*var\(--cwgsyw-space-4\)/s)
  assert.match(patterns, /\.cwgsyw-dialog:has\(\.cwgsyw-cmdb-spatial-index__create-dialog-form\) \.cwgsyw-dialog__body\s*\{[^}]*padding:\s*0[^}]*background:\s*var\(--cwgsyw-bg-surface\)/s)
  assert.match(patterns, /\.cwgsyw-dialog:has\(\.cwgsyw-cmdb-spatial-index__create-dialog-form\) \.cwgsyw-control,[\s\S]*?font-size:\s*var\(--cwgsyw-font-size-label-sm\)[\s\S]*?font-weight:\s*var\(--cwgsyw-font-weight-regular\)/)
  assert.match(patterns, /@media \(max-width: 1100px\)[\s\S]*?\.cwgsyw-cmdb-spatial-index__grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(patterns, /@media \(max-width: 520px\)[\s\S]*?\.cwgsyw-cmdb-spatial-index__grid\s*\{[^}]*minmax\(0, 1fr\)/)
  assert.match(spike, /cwgsyw-cmdb-page/)
})

test('cmdb spatial index renders Neutral list', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /空间布局/)
  assert.match(html, /机房A/)
  assert.match(html, /打开布局/)
  assert.match(html, /已发布/)
})
