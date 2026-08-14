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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/ipam/page.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ push() {}, replace() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey }) => {
          if (Array.isArray(queryKey) && queryKey[0] === 'ip-pools') {
            return {
              data: {
                records: [
                  {
                    id: 4,
                    groupId: 1,
                    name: '生产网段 A',
                    description: '核心生产',
                    cidr: '10.0.0.0/24',
                    gateway: '10.0.0.1',
                    dns: '8.8.8.8',
                    status: 'active',
                    totalCount: 254,
                    allocatedCount: 20,
                    utilizationPercent: 7.9,
                  },
                ],
                total: 1,
              },
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          return { data: [], isLoading: false, isError: false, refetch() {} }
        },
      }
    }
    if (request === '@/hooks/usePermission') {
      return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    }
    if (request === '@/store/authStore') {
      return { useAuthStore: (selector) => selector({ groupId: 1, groupScope: 'group' }) }
    }
    if (request === '@/components/shared/PermissionGuard') {
      return { PermissionGuard: ({ children }) => React.createElement(React.Fragment, null, children) }
    }
    if (request === '@/lib/api') return { default: { get: async () => ({ data: { data: [] } }), post: async () => ({}), delete: async () => ({}) } }
    if (request === '@/lib/api-error') return { getApiErrorMessage: () => 'error' }
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

test('ipam page leaves old visual entries and keeps pool APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /DataManagementPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['ip-pools', keyword, status, page\]/)
  assert.match(page, /api\.post\('\/ip-pools'/)
  assert.match(page, /\/ip-pools\/\$\{poolId\}/)
  assert.match(page, /\/ipam\/\$\{pool\.id\}/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared'/)
})

test('ipam page renders Neutral table and status', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /IP 地址池/)
  assert.match(html, /生产网段 A/)
  assert.match(html, /10\.0\.0\.0\/24/)
  assert.match(html, /活跃/)
  assert.doesNotMatch(html, /<main/)
})
