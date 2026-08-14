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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/wiki/[spaceId]/graph/page.tsx')

function compileTs(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  }).outputText
}

function loadCompiled(filePath) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') {
      return {
        useRouter: () => ({ replace() {}, push() {} }),
        useParams: () => ({ spaceId: '1' }),
      }
    }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/lib/wiki-api') {
      return { wikiApi: { getGraph: async () => ({ nodes: [], edges: [] }), listSpaces: async () => [] } }
    }
    if (request === '@xyflow/react') {
      const passthrough = ({ children }) => React.createElement('div', { 'data-reactflow': 'true' }, children)
      return {
        ReactFlow: passthrough,
        Background: () => React.createElement('div', null, 'Background'),
        Controls: () => React.createElement('div', null, 'Controls'),
        MiniMap: () => React.createElement('div', null, 'MiniMap'),
        MarkerType: { ArrowClosed: 'arrowclosed' },
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: (options) => {
          const key = options && options.queryKey ? options.queryKey[0] : ''
          if (key === 'wiki-graph') {
            return {
              data: {
                nodes: [{ id: 10, title: '入门指南', status: 'published' }],
                edges: [{ source: 10, target: 11 }],
              },
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (key === 'wiki-spaces') return { data: [{ id: 1, name: '运维手册' }], isLoading: false, isError: false, refetch() {} }
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
      const hit = [resolved, resolved + '.tsx', resolved + '.ts', resolved + '/index.ts', resolved + '/index.tsx'].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit) return loadCompiled(hit)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [resolved + '.tsx', resolved + '.ts', resolved].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
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

test('wiki graph leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['wiki-graph', sid\]/)
  assert.match(page, /wikiApi\.getGraph/)
  assert.match(page, /hasPermission\('wiki', 'read'\)/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /border-v2-/)
  assert.doesNotMatch(page, /#22c55e/)
})

test('wiki graph renders Neutral dashboard chrome', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /知识图谱/)
  assert.match(html, /1 个页面，1 条引用/)
  assert.match(html, /返回空间/)
})
