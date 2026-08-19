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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/devices/[id]/page.tsx')
const rowPath = path.join(frontendRoot, 'src/components/device/CredentialRow.tsx')

function compileTs(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  }).outputText
}

function loadCompiled(filePath) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') return { useParams: () => ({ id: '9' }), useRouter: () => ({ push() {} }) }
    if (request === 'next/link') {
      return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: () => ({
          data: {
            id: 9,
            name: 'core-sw',
            ip: '10.0.0.1',
            deviceType: 'network',
            category: '交换机',
            groupName: '网络组',
            description: '核心交换机',
            ciInstanceId: 3,
            ciInstanceName: 'sw-ci',
            ciModelCode: 'switch',
            credentials: [{ id: 1, username: 'admin', description: 'SSH', groupId: 4, groupName: '网络组' }],
          },
          isLoading: false,
          isError: false,
          refetch() {},
        }),
      }
    }
    if (request === '@/hooks/usePermission') {
      return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    }
    if (request === '@/store/authStore') {
      return { useAuthStore: (selector) => selector({ groupScope: 'platform', groupId: 4 }) }
    }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/components/shared/PermissionGuard') {
      return { PermissionGuard: ({ children }) => React.createElement(React.Fragment, null, children) }
    }
    if (request === '@/lib/api') {
      return { default: { get: async () => ({ data: { data: 'secret' } }), put: async () => ({}), post: async () => ({}), delete: async () => ({}) } }
    }
    if (request === '@/lib/api-error') {
      return { getApiErrorMessage: () => 'error', isAxiosError: () => false }
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
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit) return loadCompiled(hit)
    }
    if (request.startsWith('./') && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit)
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  const mod = new Module(filePath, module)
  mod.filename = filePath
  mod.paths = Module._nodeModulePaths(path.dirname(filePath))
  try {
    mod._compile(compiled, filePath)
  } finally {
    Module._load = originalLoad
  }
  return mod.exports
}

test('device detail and credential row leave old visual entries and keep APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const row = fs.readFileSync(rowPath, 'utf8')
  assert.match(page, /DetailDrawerPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /showSubtitle=\{Boolean\(subtitle\)\}/)
  assert.doesNotMatch(page, /设备详情与访问凭证/)
  assert.doesNotMatch(page, /cwgsyw-permission-group/)
  assert.doesNotMatch(page, /<Card/)
  assert.doesNotMatch(page, /> \$\{device\.groupName/)
  assert.match(page, /queryKey: \['device', id\]/)
  assert.match(page, /\/devices\/\$\{id\}\/credentials/)
  assert.doesNotMatch(page, /confirm\(/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(row, /@\/components\/design-system/)
  assert.match(row, /\/devices\/credentials\/\$\{credentialId\}\/reveal/)
  assert.match(row, /RSA-OAEP/)
  assert.doesNotMatch(row, /confirm\(/)
})

test('device detail renders Neutral detail composition and credential groups', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /core-sw/)
  assert.match(html, /账号密码/)
  assert.match(html, /admin/)
  assert.match(html, /cwgsyw-devices-detail/)
  assert.match(html, /cwgsyw-devices-panel/)
  assert.match(html, /cwgsyw-devices-cred/)
  assert.doesNotMatch(html, /设备详情与访问凭证/)
  assert.doesNotMatch(html, /cwgsyw-permission-group/)
  assert.doesNotMatch(html, /<main/)
})
