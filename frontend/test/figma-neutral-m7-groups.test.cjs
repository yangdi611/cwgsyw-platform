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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/groups/page.tsx')
const groupDialogPath = path.join(frontendRoot, 'src/components/group/GroupDialog.tsx')
const memberDialogPath = path.join(frontendRoot, 'src/components/group/MemberDialog.tsx')
const lifecyclePath = path.join(frontendRoot, 'src/components/group/GroupLifecycleDialog.tsx')

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
        useQueryClient: () => ({ invalidateQueries: async () => {} }),
        useQuery: ({ queryKey }) => {
          if (Array.isArray(queryKey) && queryKey[0] === 'groups') {
            return {
              data: [
                {
                  id: 3,
                  code: 'plat',
                  name: '平台组',
                  description: '核心组',
                  groupType: 'business',
                  isBuiltin: false,
                  leaderId: 1,
                  leaderRealName: '杨迪',
                  memberCount: 2,
                  memberPreview: ['杨迪', '李四'],
                  state: 'active',
                },
              ],
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'group-lifecycle-preflight') {
            return {
              data: {
                action: 'archive',
                eligible: true,
                group: {
                  id: 3,
                  tenantId: 't1',
                  code: 'plat',
                  name: '平台组',
                  state: 'active',
                  groupType: 'business',
                  builtin: false,
                  updatedAt: '2026-01-01T00:00:00Z',
                },
                activeCounts: {},
                historicalCounts: {},
                blockers: [],
                purgeEligibleAt: null,
                snapshotHash: 'hash',
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
      return { useAuthStore: (selector) => selector({ groupScope: 'platform' }) }
    }
    if (request === '@/lib/api') {
      return { default: { get: async () => ({ data: { data: [] } }), post: async () => ({}), put: async () => ({}), delete: async () => ({}) } }
    }
    if (request === '@/lib/api-error') {
      return {
        getApiErrorMessage: () => 'error',
        isAxiosError: () => false,
      }
    }
    if (request.startsWith('@base-ui/react/')) {
      const passthrough = ({ children }) => React.createElement(React.Fragment, null, children)
      const node = ({ children, className, ...props }) => React.createElement('div', { className, ...props }, children)
      return {
        Dialog: { Root: passthrough, Portal: passthrough, Backdrop: node, Popup: node, Title: node, Description: node, Close: node },
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

test('groups page and dialogs leave old visual entries and keep group APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const groupDialog = fs.readFileSync(groupDialogPath, 'utf8')
  const memberDialog = fs.readFileSync(memberDialogPath, 'utf8')
  const lifecycle = fs.readFileSync(lifecyclePath, 'utf8')
  assert.match(page, /DataManagementPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['groups', listState\]/)
  assert.match(page, /data-testid="group-state-active"/)
  assert.match(page, /data-testid=\{`group-archive-\$\{group\.id\}`\}/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(groupDialog, /@\/components\/design-system/)
  assert.doesNotMatch(memberDialog, /@\/components\/design-system/)
  assert.doesNotMatch(lifecycle, /@\/components\/design-system/)
  assert.match(groupDialog, /api\.post\('\/groups'/)
  assert.match(memberDialog, /\/groups\/\$\{groupId\}\/members/)
  assert.match(lifecycle, /lifecycle-preflight/)
  assert.match(lifecycle, /data-testid="group-lifecycle-submit"/)
})

test('groups page renders Data Management composition and Neutral table', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /cwgsyw-page--embedded/)
  assert.match(html, /用户组管理/)
  assert.match(html, /cwgsyw-table/)
  assert.match(html, /平台组/)
  assert.match(html, /data-testid="group-state-archived"/)
  assert.doesNotMatch(html, /<main/)
})

test('group dialogs render Neutral overlays and keep lifecycle test ids', () => {
  const groupDialog = fs.readFileSync(groupDialogPath, 'utf8')
  const lifecycle = fs.readFileSync(lifecyclePath, 'utf8')
  assert.match(groupDialog, /<NeutralDialog/)
  assert.match(groupDialog, /新建组/)
  assert.match(groupDialog, /cwgsyw-form/)
  assert.match(lifecycle, /<NeutralDialog/)
  assert.match(lifecycle, /归档用户组/)
  assert.match(lifecycle, /data-testid="group-lifecycle-preflight"/)
  assert.match(lifecycle, /data-testid="group-lifecycle-reason"/)
})
