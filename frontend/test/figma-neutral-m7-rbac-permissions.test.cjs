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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/rbac/permissions/page.tsx')

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

function loadCompiled(filePath, roleId = '2') {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === 'next/navigation' || request.includes('next/navigation')) {
      return {
        useSearchParams: () => ({ get: (key) => (key === 'roleId' ? roleId : null) }),
        useRouter: () => ({ push() {}, replace() {} }),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey }) => {
          if (Array.isArray(queryKey) && queryKey[0] === 'resources') {
            return { data: [{ id: 1, code: 'wiki', name: '知识库', actions: ['read', 'update'] }], isLoading: false, isError: false, refetch() {} }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'all-permissions') {
            return {
              data: [
                { id: 11, code: 'wiki:read', name: '查看', resourceId: 1, action: 'read' },
                { id: 12, code: 'wiki:update', name: '编辑', resourceId: 1, action: 'update' },
              ],
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'role-permissions') {
            return { data: [{ id: 11, code: 'wiki:read', name: '查看', resourceId: 1, action: 'read' }], isLoading: false, isError: false, refetch() {} }
          }
          return { data: [], isLoading: false, isError: false, refetch() {} }
        },
      }
    }
    if (request === '@/lib/api') {
      return { default: { get: async () => ({ data: { data: [] } }), put: async () => ({}) } }
    }
    if (request.startsWith('@/')) {
      const resolved = path.join(frontendRoot, 'src', request.slice(2))
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit) return loadCompiled(hit, roleId)
    }
    if (request.startsWith('./') && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit, roleId)
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

test('permissions page leaves old visual entries and keeps the assign API', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /DataManagementPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['resources'\]/)
  assert.match(page, /queryKey: \['all-permissions'\]/)
  assert.match(page, /queryKey: \['role-permissions', roleId\]/)
  assert.match(page, /\/rbac\/roles\/\$\{roleId\}\/permissions/)
  assert.match(page, /permissionIds/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.match(page, /请先选择角色/)
})

test('permissions page renders Neutral assignment groups when a role is selected', () => {
  const page = loadCompiled(pagePath, '2')
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /权限配置/)
  assert.match(html, /知识库/)
  assert.match(html, /保存权限/)
  assert.doesNotMatch(html, /<main/)
})

test('permissions page asks the user to pick a role when roleId is missing', () => {
  const page = loadCompiled(pagePath, null)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /请先选择角色/)
})
