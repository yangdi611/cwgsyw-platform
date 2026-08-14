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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/wiki/[spaceId]/[pageId]/edit/page.tsx')

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
        useParams: () => ({ spaceId: '1', pageId: '10' }),
      }
    }
    if (request === 'next/dynamic') return () => function Dyn() { return React.createElement('div', null, 'MDEditor') }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/components/wiki/wikiMarkdownComponents') {
      return { createWikiMarkdownComponents: () => ({}) }
    }
    if (request === '@/lib/wiki-api') {
      return {
        wikiApi: {
          listSpaces: async () => [],
          getPage: async () => ({}),
          savePage: async () => ({}),
          search: async () => ({ records: [] }),
          uploadAttachment: async () => ({ url: '' }),
        },
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ setQueryData() {}, invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: (options) => {
          const key = options && options.queryKey ? options.queryKey[0] : ''
          if (key === 'wiki-spaces') return { data: [{ id: 1, name: '运维手册' }], isLoading: false, isError: false, refetch() {} }
          if (key === 'wiki-page') {
            return {
              data: { id: 10, title: '入门指南', content: '# 入门', canWrite: true },
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
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

test('wiki editor leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['wiki-page', pid\]/)
  assert.match(page, /wikiApi\.getPage/)
  assert.match(page, /wikiApi\.savePage/)
  assert.match(page, /\.search\(\{ keyword/)
  assert.match(page, /wikiApi\.uploadAttachment/)
  assert.match(page, /preview=\"live\"/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /border-v2-/)
})

test('wiki editor renders Neutral chrome', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /入门指南/)
  assert.match(html, /保存/)
  assert.match(html, /返回/)
  assert.match(html, /MDEditor/)
})
