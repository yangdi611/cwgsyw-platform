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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/work/page.tsx')
const listPath = path.join(frontendRoot, 'src/components/work/WorkItemList.tsx')
const drawerPath = path.join(frontendRoot, 'src/components/work/ApprovalTaskDrawer.tsx')

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
    if (request === 'next/navigation') {
      return {
        useRouter: () => ({ push() {}, replace() {} }),
        useSearchParams: () => ({ get: () => null, toString: () => '' }),
      }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false, variables: undefined }),
        useQuery: ({ queryKey }) => {
          if (Array.isArray(queryKey) && queryKey[0] === 'work-item-counts') {
            return { data: { execute: 1, approve: 0, initiated: 0, copied: 0, completed: 2 }, isLoading: false }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'work-items') {
            return {
              data: {
                records: [
                  {
                    itemType: 'task',
                    itemId: '11',
                    taskId: 11,
                    title: '机房巡检',
                    subtitle: '每日巡检',
                    status: 'in_progress',
                    priority: 'high',
                    businessDate: '2026-08-14',
                    dueAt: '2026-08-14T18:00:00',
                    overdue: false,
                    actionRequired: true,
                    href: '/tasks/11',
                  },
                ],
                total: 1,
              },
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'work-item-template-options') {
            return { data: [{ id: 1, name: '日报' }], isLoading: false }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'work-item-group-options') {
            return { data: [{ id: 3, name: '主机组' }], isLoading: false }
          }
          return { data: undefined, isLoading: false, isError: false, refetch() {} }
        },
      }
    }
    if (request === '@/hooks/usePermission') {
      return { usePermission: () => ({ hasPermission: () => true }) }
    }
    if (request === '@/lib/task-plan-api') {
      return { listPublishedTemplates: async () => [], listDirectoryGroups: async () => [] }
    }
    if (request === '@/lib/work-item-api') {
      return { listWorkItems: async () => ({ records: [], total: 0 }), getWorkItemCounts: async () => ({}) }
    }
    if (request === '@/lib/approval-api') {
      return {
        getApprovalTask: async () => ({}),
        actOnApprovalTask: async () => ({}),
        downloadApprovalAttachment: async () => {},
        approvalActionLabel: (name) => name,
      }
    }
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
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
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

test('work page and list leave old visual entries and keep work APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const list = fs.readFileSync(listPath, 'utf8')
  const drawer = fs.readFileSync(drawerPath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(list, /DataManagementPage/)
  assert.match(list, /queryKey: \['work-items'/)
  assert.match(list, /listWorkItems/)
  assert.match(drawer, /NeutralDrawer/)
  assert.match(drawer, /queryKey: \['approval-task', approvalTaskId\]/)
  assert.match(drawer, /actOnApprovalTask/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(list, /@\/components\/design-system/)
  assert.doesNotMatch(drawer, /@\/components\/design-system/)
  assert.doesNotMatch(drawer, /@\/components\/shared/)
})

test('work list renders Neutral tabs and action-required work item', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /我的工作/)
  assert.match(html, /待执行/)
  assert.match(html, /机房巡检/)
  assert.match(html, /需要处理/)
  assert.doesNotMatch(html, /<main/)
})
