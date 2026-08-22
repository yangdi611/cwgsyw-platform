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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/wiki/[spaceId]/page.tsx')
const layoutPath = path.join(frontendRoot, 'src/app/(dashboard)/wiki/[spaceId]/layout.tsx')

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
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/lib/wiki-api') {
      return {
        wikiApi: {
          listSpaces: async () => [],
          getTree: async () => [],
          exportSpace: async () => {},
        },
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: (options) => {
          const key = options && options.queryKey ? options.queryKey[0] : ''
          if (key === 'wiki-spaces') {
            return {
              data: [{ id: 1, name: '运维手册', description: '官方文档', system: true }],
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (key === 'wiki-tree') {
            return {
              data: [{ id: 10, title: '入门指南', status: 'published', slug: 'intro', sortOrder: 1, spaceId: 1, children: [] }],
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          return { data: [], isLoading: false, isError: false, refetch() {} }
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

test('wiki space home leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const layout = fs.readFileSync(layoutPath, 'utf8')
  const css = fs.readFileSync(path.resolve(__dirname, '../src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['wiki-spaces'\]/)
  assert.match(page, /queryKey: \['wiki-tree', sid\]/)
  assert.match(page, /wikiApi\.listSpaces/)
  assert.match(page, /wikiApi\.getTree/)
  assert.match(layout, /wikiApi\.exportSpace/)
  assert.match(layout, /cwgsyw-wiki-shell__header/)
  assert.match(css, /\.cwgsyw-wiki-shell__header \{[\s\S]{0,160}grid-column: 1 \/ -1/)
  assert.match(css, /\.cwgsyw-wiki-shell__nav \{[\s\S]{0,180}grid-row: 2/)
  assert.match(css, /\.cwgsyw-wiki-space-home \.cwgsyw-devices-panel__body \{[\s\S]{0,120}overflow: auto/)
  assert.match(layout, /WikiShellHeaderProvider/)
  assert.match(layout, /WikiShellToggle/)
  assert.match(page, /showSubtitle=\{false\}/)
  assert.match(page, /WikiShellToggle/)
  assert.match(page, /cwgsyw-wiki-space-home__head-start/)
  assert.doesNotMatch(page, /欢迎来到知识空间/)
  const chrome = fs.readFileSync(path.resolve(__dirname, '../src/components/wiki/WikiShellChrome.tsx'), 'utf8')
  assert.match(chrome, /icon=\{ctx\.collapsed \? 'chevron-next' : 'chevron-previous'\}/)
  assert.match(chrome, /aria-label=\{ctx\.collapsed \? '展开目录' : '收起目录'\}/)
  assert.doesNotMatch(layout, /cwgsyw-files-tree__chevron/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /border-v2-/)
  assert.doesNotMatch(layout, /text-v2-/)
  assert.doesNotMatch(layout, /border-v2-/)
})

test('wiki space home renders Neutral recent pages', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /运维手册/)
  assert.match(html, /最近更新/)
  assert.match(html, /入门指南/)
  assert.match(html, /已发布/)
  assert.match(html, /知识图谱/)
})
