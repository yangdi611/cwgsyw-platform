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

function compile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  }).outputText
}

function loadCompiled(filePath, queryImpl) {
  const compiled = compile(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {} }) }
    if (request === 'next/link') return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') return { get: async () => ({ data: { data: { records: [], total: 0 } } }) }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: queryImpl || (() => ({ data: { records: [] }, isLoading: false, isError: false, refetch() {} })),
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
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      if (hit) return loadCompiled(hit, queryImpl)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit, queryImpl)
    }
    return originalLoad.call(this, parent && parent.filename ? request : request, parent, isMain)
  }
  const mod = new Module(filePath, module)
  mod.filename = filePath
  mod.paths = Module._nodeModulePaths(path.dirname(filePath))
  try { mod._compile(compiled, filePath) } finally { Module._load = originalLoad }
  return mod.exports
}

function loadShareLib() {
  return loadCompiled(path.join(frontendRoot, 'src/lib/cmdb-instance-share.ts'))
}

test('share ticks stay proportional and sum to 100', () => {
  const { allocateTicks, buildInstanceShareView } = loadShareLib()
  const ticks = allocateTicks([8, 2])
  assert.equal(ticks.reduce((sum, value) => sum + value, 0), 100)
  assert.equal(ticks[0], 80)
  assert.equal(ticks[1], 20)

  const view = buildInstanceShareView([
    { modelId: 'host', displayName: '主机', instanceCount: 12 },
    { modelId: 'mysql', displayName: 'MySQL实例', instanceCount: 3 },
    { modelId: 'empty', displayName: '空模型', instanceCount: 0 },
  ])
  assert.equal(view.total, 15)
  assert.equal(view.slices.length, 2)
  assert.equal(view.collapsed, false)
  assert.match(view.conclusion, /主机/)
})

test('share view collapses the long tail into other', () => {
  const { buildInstanceShareView, CMDB_SHARE_OTHER_KEY } = loadShareLib()
  const models = Array.from({ length: 8 }, (_, index) => ({
    modelId: `m${index}`,
    displayName: `模型${index}`,
    instanceCount: 8 - index,
  }))
  const view = buildInstanceShareView(models)
  assert.equal(view.collapsed, true)
  assert.equal(view.slices.length, 6)
  assert.equal(view.slices.at(-1).key, CMDB_SHARE_OTHER_KEY)
  assert.equal(view.slices.at(-1).count, 6)
  assert.equal(view.ticks.reduce((sum, value) => sum + value, 0), 100)
})

test('home cmdb share chart renders F4 ticks from model counts', () => {
  const filePath = path.join(frontendRoot, 'src/components/cmdb/CmdbInstanceShareChart.tsx')
  const loaded = loadCompiled(filePath, () => ({
    data: {
      records: [
        { modelId: 'host', displayName: '主机', instanceCount: 8 },
        { modelId: 'mysql', displayName: 'MySQL实例', instanceCount: 2 },
      ],
    },
    isLoading: false,
    isError: false,
    refetch() {},
  }))
  const html = renderToStaticMarkup(React.createElement(loaded.CmdbInstanceShareChart))
  assert.match(html, /CI 实例构成/)
  assert.match(html, /主机/)
  assert.match(html, /80%/)
  assert.match(html, /<line /)
  assert.match(html, /href="\/cmdb\/instances\/by-model\/host"/)
  assert.match(html, /cwgsyw-cmdb-share__legend-row/)
  const source = fs.readFileSync(filePath, 'utf8')
  assert.doesNotMatch(source, /opacity: 1 - index \* 0\.08/)
  assert.match(source, /\{hot \? hot\.count : view\.total\}/)
  assert.match(source, /\{hot \? hot\.label : '实例'\}/)
  assert.doesNotMatch(source, /hot\.count\} · \$\{hot\.percent/)
})

test('share legend stretches across the column and wipes orange on hover', () => {
  const css = fs.readFileSync(path.join(frontendRoot, 'src/components/cmdb/cmdb-instance-share-chart.css'), 'utf8')
  assert.match(css, /\.cwgsyw-cmdb-share__legend-row \{[\s\S]*width: 100%/)
  assert.match(css, /\.cwgsyw-cmdb-share__chip \{[\s\S]*flex: 1 1 0/)
  assert.match(css, /border-radius: 999px/)
  assert.match(css, /transform: translateX\(-100%\)/)
  assert.match(css, /640ms/)
  assert.match(css, /--cwgsyw-status-warning-200/)
})
