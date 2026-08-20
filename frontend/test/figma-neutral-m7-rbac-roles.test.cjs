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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/rbac/roles/page.tsx')
const dialogPath = path.join(frontendRoot, 'src/components/rbac/RoleDialog.tsx')

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
    if (request === 'next/link') {
      return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: ({ queryKey }) => {
          if (Array.isArray(queryKey) && queryKey[0] === 'roles') {
            return {
              data: [
                {
                  id: 2,
                  name: 'Wiki 只读',
                  code: 'wiki_readonly',
                  scope: 'tenant',
                  description: '只读知识库',
                  roleType: 'functional',
                  isBuiltin: false,
                  isLegacy: true,
                },
              ],
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
    if (request === '@/components/shared/PermissionGuard') {
      return { PermissionGuard: ({ children }) => React.createElement(React.Fragment, null, children) }
    }
    if (request === '@/lib/api') {
      return { default: { get: async () => ({ data: { data: [] } }), post: async () => ({}), put: async () => ({}), delete: async () => ({}) } }
    }
    if (request === 'next/navigation' || request.includes('next/navigation')) {
      return { useRouter: () => ({ push() {}, replace() {} }), useSearchParams: () => ({ get: () => null }) }
    }
    if (request === '@/lib/api-error') {
      return { getApiErrorMessage: () => 'error' }
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

test('roles page and dialog leave old visual entries and keep role APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const dialog = fs.readFileSync(dialogPath, 'utf8')
  assert.match(page, /DataManagementPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['roles'\]/)
  assert.match(page, /api\.delete\(`\/rbac\/roles\/\$\{deleteTarget\.id\}`\)/)
  assert.match(page, /\/rbac\/permissions\?roleId=/)
  assert.doesNotMatch(page, /window\.confirm/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(dialog, /@\/components\/design-system/)
  assert.match(dialog, /api\.post\('\/rbac\/roles'/)
  assert.match(dialog, /\/rbac\/roles\/\$\{role!\.id\}\/permissions/)
})

test('roles page renders Data Management composition and Neutral table', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /cwgsyw-page--embedded/)
  assert.match(html, /角色管理/)
  assert.match(html, /Wiki 只读/)
  assert.match(html, /兼容角色/)
  assert.match(html, /配置权限/)
  assert.doesNotMatch(html, /<main/)
})

test('role dialog renders Neutral overlay and permission groups', () => {
  const dialog = fs.readFileSync(dialogPath, 'utf8')
  assert.match(dialog, /<NeutralDialog/)
  assert.match(dialog, /新建功能角色/)
  assert.match(dialog, /cwgsyw-form/)
  assert.match(dialog, /角色编码/)
})
