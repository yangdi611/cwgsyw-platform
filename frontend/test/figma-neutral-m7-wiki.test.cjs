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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/wiki/page.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/store/authStore') {
      return { useAuthStore: (selector) => selector({ user: { username: 'admin' }, groupId: 1, groupScope: 'tenant' }) }
    }
    if (request === '@/lib/wiki-api') {
      return { wikiApi: { listSpaces: async () => [], createSpace: async () => ({}), updateSpace: async () => ({}), deleteSpace: async () => {} } }
    }
    if (request === '@/lib/api') return { get: async () => ({ data: { data: [{ id: 1, name: '平台组' }] } }) }
    if (request === '@/components/authorization/ResourceAccessDialog') {
      return { ResourceAccessDialog: () => null }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: (options) => {
          const key = options && options.queryKey ? options.queryKey[0] : ''
          if (key === 'wiki-spaces') {
            return {
              data: [
                {
                  id: 1,
                  name: '运维手册',
                  description: '官方文档',
                  pageCount: 4,
                  updatedAt: '2026-08-14T10:00:00Z',
                  createdByName: 'system',
                  readOnly: true,
                  system: true,
                  writeScope: 'super_admin_only',
                  createdBy: 0,
                  canManageAcl: false,
                  canCreatePage: false,
                },
                {
                  id: 2,
                  name: '网络组知识库',
                  description: '团队空间',
                  pageCount: 8,
                  updatedAt: '2026-08-14T10:00:00Z',
                  createdByName: 'admin',
                  readOnly: false,
                  system: false,
                  writeScope: null,
                  createdBy: 1,
                  canManageAcl: true,
                  canCreatePage: true,
                },
              ],
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          return { data: [{ id: 1, name: '平台组' }], isLoading: false, isError: false, refetch() {} }
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

test('wiki spaces leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['wiki-spaces'\]/)
  assert.match(page, /wikiApi\.listSpaces/)
  assert.match(page, /wikiApi\.createSpace/)
  assert.match(page, /wikiApi\.updateSpace/)
  assert.match(page, /wikiApi\.deleteSpace/)
  assert.match(page, /hasPermission\('wiki', 'read'\)/)
  assert.match(page, /hasPermission\('wiki', 'create'\)/)
  assert.doesNotMatch(page, /label="(?:官方手册|系统维护)" tone="info"/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /border-v2-/)
})

test('wiki spaces renders Neutral space cards', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /知识空间/)
  assert.match(html, /官方手册/)
  assert.match(html, /运维手册/)
  assert.match(html, /网络组知识库/)
  assert.match(html, /新建空间/)
})
