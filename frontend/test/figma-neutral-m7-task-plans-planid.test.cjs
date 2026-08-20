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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/plans/[planId]/page.tsx')
const editorPath = path.join(frontendRoot, 'src/components/task-plan/TaskPlanEditor.tsx')
const apiPath = path.join(frontendRoot, 'src/lib/task-plan-api.ts')

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

function queryResult(data) {
  return { data, isLoading: false, isError: false, refetch() {} }
}

function planDetail(status) {
  return {
    id: 12,
    name: '机房日报',
    description: '每日机房巡检计划',
    templateVersionId: 9,
    status,
    scheduleType: 'daily',
    scheduleConfig: { time: '09:00', dueAfterHours: 10, priority: 'normal' },
    generationMode: 'per_user',
    assignmentRule: { strategy: 'group_members', groupIds: [4] },
    ciScopeConfig: { selections: [] },
    reminderConfig: { beforeDueHours: [2], onOverdue: true },
    escalationConfig: {},
    generateAheadDays: 7,
    startDate: '2026-08-14',
    updatedAt: '2026-08-14T00:00:00Z',
  }
}

function loadCompiled(filePath, planStatus = 'draft') {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') {
      return {
        useRouter: () => ({ push() {} }),
        useParams: () => ({ planId: '12' }),
      }
    }
    if (request === 'next/link') {
      return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/lib/approval-api') return { listPublishedApprovalSchemes: async () => [] }
    if (request === '@/lib/task-plan-api') {
      return {
        getTaskPlan: async () => planDetail(planStatus),
        updateTaskPlan: async (planId, payload) => ({ id: planId, ...payload }),
        createTaskPlan: async (payload) => ({ id: 21, ...payload }),
        previewTaskPlan: async () => ({ templateName: '巡检模板', totalTaskCount: 1, warnings: [], occurrences: [] }),
        listPublishedTemplates: async () => [{ id: 3, name: '巡检模板', latestVersionId: 9 }],
        listDirectoryUsers: async () => [],
        listDirectoryGroups: async () => [{ id: 4, name: '运维组', code: 'ops' }],
        listModelGroups: async () => [],
        listModels: async () => [],
        listInstances: async () => [],
        resolveCiScope: async () => ({ total: 0, truncated: false, warnings: [] }),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: ({ mutationFn }) => ({ mutate() { return mutationFn?.() }, isPending: false }),
        useQuery: ({ queryKey, enabled }) => {
          if (enabled === false) return queryResult(undefined)
          switch (queryKey[0]) {
            case 'task-plan':
              return queryResult(planDetail(planStatus))
            case 'task-plan-template-options':
              return queryResult([{ id: 3, name: '巡检模板', latestVersionId: 9 }])
            case 'task-plan-approval-options':
              return queryResult([])
            case 'task-plan-user-options':
              return queryResult([])
            case 'task-plan-group-options':
              return queryResult([{ id: 4, name: '运维组', code: 'ops' }])
            case 'task-plan-ci-groups':
            case 'task-plan-ci-models':
            case 'task-plan-ci-instances':
              return queryResult([])
            case 'task-plan-ci-preview':
              return queryResult({ total: 0, truncated: false, warnings: [] })
            default:
              return queryResult(undefined)
          }
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
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit) return loadCompiled(hit, planStatus)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit, planStatus)
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

test('plan detail page leaves old visual entries and keeps get/update contracts', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const editor = fs.readFileSync(editorPath, 'utf8')
  const api = fs.readFileSync(apiPath, 'utf8')
  assert.match(page, /TaskPlanEditor/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /useParams/)
  assert.match(editor, /queryKey: \['task-plan', planId\]/)
  assert.match(editor, /updateTaskPlan\(planId, payload\)/)
  assert.match(editor, /getTaskPlan/)
  assert.match(api, /export async function getTaskPlan/)
  assert.match(api, /export async function updateTaskPlan/)
  assert.match(api, /api\.get\(`\/task-plans\/\$\{planId\}`/)
  assert.match(api, /api\.put\(`\/task-plans\/\$\{planId\}`/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /text-v2-/)
})

test('draft plan detail renders Neutral editor and stays editable', () => {
  const page = loadCompiled(pagePath, 'draft')
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /cwgsyw-page--embedded/)
  assert.match(html, /编辑计划：机房日报/)
  assert.match(html, /草稿/)
  assert.match(html, /下一步/)
  assert.doesNotMatch(html, /已生效或结束的计划只读/)
  assert.doesNotMatch(html, /<main/)
})

test('active plan detail stays read-only', () => {
  const page = loadCompiled(pagePath, 'active')
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /编辑计划：机房日报/)
  assert.match(html, /运行中/)
  assert.match(html, /已生效或结束的计划只读/)
  assert.doesNotMatch(html, /保存计划/)
})
