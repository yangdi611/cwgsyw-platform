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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/users/page.tsx')
const dialogPath = path.join(frontendRoot, 'src/components/user/UserDialog.tsx')
const authPath = path.join(frontendRoot, 'src/components/user/UserAuthorizationDialog.tsx')

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
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: ({ queryKey }) => {
          if (Array.isArray(queryKey) && queryKey[0] === 'users') {
            return {
              data: {
                records: [
                  {
                    id: 7,
                    username: 'byron',
                    realName: '杨迪',
                    email: 'byron@example.com',
                    groupName: '平台组',
                    status: 1,
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
    if (request === '@/lib/api') {
      return { default: { get: async () => ({ data: { data: [] } }), post: async () => ({}), put: async () => ({}), delete: async () => ({}) } }
    }
    if (request.startsWith('@base-ui/react/')) {
      const passthrough = ({ children }) => React.createElement(React.Fragment, null, children)
      const node = ({ children, className, render, ...props }) =>
        React.createElement('div', { className, ...props }, render ? render.props?.children ?? children : children)
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

test('users page and dialogs leave old visual entries and keep the user APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const dialog = fs.readFileSync(dialogPath, 'utf8')
  const auth = fs.readFileSync(authPath, 'utf8')
  assert.match(page, /DataManagementPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /api\.get\('\/users'/)
  assert.match(page, /keyword: keyword \|\| undefined/)
  assert.match(page, /api\.delete\(`\/users\/\$\{deleteTarget\.id\}`\)/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(dialog, /@\/components\/design-system/)
  assert.doesNotMatch(auth, /@\/components\/design-system/)
  assert.doesNotMatch(auth, /text-v2-/)
  assert.match(dialog, /api\.post\('\/users'/)
  assert.match(dialog, /reset-password/)
  assert.match(auth, /group-memberships/)
  assert.match(auth, /role-assignments/)
})

test('users page renders Data Management composition and Neutral table', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /cwgsyw-page--embedded/)
  assert.match(html, /用户管理/)
  assert.match(html, /cwgsyw-table/)
  assert.match(html, /@byron/)
  assert.match(html, /启用/)
  assert.doesNotMatch(html, /<main/)
})

test('user dialogs render Neutral overlays without old v2 classes', () => {
  const userDialog = fs.readFileSync(dialogPath, 'utf8')
  const authorizationDialog = fs.readFileSync(authPath, 'utf8')
  assert.match(userDialog, /<NeutralDialog/)
  assert.match(userDialog, /新建用户/)
  assert.match(userDialog, /cwgsyw-form/)
  assert.match(authorizationDialog, /<NeutralDialog/)
  assert.match(authorizationDialog, /组织与作用域授权/)
})
