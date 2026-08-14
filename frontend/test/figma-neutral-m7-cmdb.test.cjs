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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/page.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {}, back() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/components/cmdb/InstanceBrowserSection') return { __esModule: true, default: () => null }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') {
      return {
        get: async () => ({ data: { data: { records: [{ id: '1', name: '变更审批流', key: 'changeDocApproval', version: 2, category: '审批', activeVersion: 2 }], total: 1 } } }),
        put: async () => ({ data: {} }),
        post: async () => ({ data: {} }),
        delete: async () => ({ data: {} }),
      }
    }
    if (request === '@/lib/api-error') return { getApiErrorMessage: (_err, fallback) => fallback }
    if (request === '@/types/api') {
      return { extractPaginated: (r) => r.data.data }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: ({ queryKey } = {}) => {
          const key = String(queryKey || '')
          if (key.includes('cmdb-model-groups')) return { data: [{ code: 'hardware', name: '硬件', sortOrder: 1 }] }
          if (key.includes('cmdb-models')) return { data: { records: [{ modelId: 'server', name: '服务器', displayName: '服务器', group: 'hardware', groupName: '硬件', instanceCount: 3, attributes: [1, 2] }], total: 1 } }
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

test('cmdb overview leaves colored catalog and old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['cmdb-models-overview'\]/)
  assert.match(page, /queryKey: \['cmdb-model-groups-overview'\]/)
  assert.match(page, /InstanceBrowserSection/)
  assert.doesNotMatch(page, /GROUP_PALETTES/)
  assert.doesNotMatch(page, /#2563eb/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared\/PageHeader/)
  assert.doesNotMatch(page, /text-v2-/)
})

test('cmdb overview renders Neutral catalog', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /概览/)
  assert.match(html, /各类模型/)
})
