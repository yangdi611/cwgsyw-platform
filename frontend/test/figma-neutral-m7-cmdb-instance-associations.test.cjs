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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/instances/by-model/[modelCode]/[id]/associations/page.tsx')

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
    if (request === 'next/navigation') {
      return {
        useRouter: () => ({ replace() {}, push() {}, back() {} }),
        useParams: () => ({ modelCode: 'server', id: '11' }),
      }
    }
    if (request === 'next/link') {
      return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/lib/api') {
      return {
        get: async () => ({ data: { data: [] } }),
        delete: async () => ({ data: {} }),
      }
    }
    if (request === '@/components/cmdb/CiInstanceDrawer') return { CiInstanceDrawer: () => null }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey } = {}) => {
          if (queryKey?.[0] === 'cmdb-instance') {
            return { data: { name: 'web-01', modelId: 'server' }, isLoading: false }
          }
          if (queryKey?.[0] === 'cmdb-rel') {
            return {
              data: [{
                id: 3,
                srcInstanceId: 11,
                srcInstanceName: 'web-01',
                dstInstanceId: 22,
                dstInstanceName: 'sw-01',
                associationKind: 'connected_to',
                metadata: { port: 'eth0' },
                createdAt: '2026-08-14T00:00:00Z',
              }],
              isLoading: false,
            }
          }
          if (queryKey?.[0] === 'cmdb-association-defs') {
            return { data: [{ defId: 'connected_to', name: '连接到' }], isLoading: false }
          }
          return { data: undefined, isLoading: false }
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

test('cmdb instance associations leaves old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['cmdb-rel', id\]/)
  assert.match(page, /\/cmdb\/instances\/\$\{id\}\/relations/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /lucide-react/)
})

test('cmdb instance associations renders Neutral table', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /关联管理/)
  assert.match(html, /sw-01/)
  assert.match(html, /连接到/)
  assert.match(html, /新建关联/)
})
