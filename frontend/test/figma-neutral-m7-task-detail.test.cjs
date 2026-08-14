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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/[taskId]/page.tsx')
const detailPath = path.join(frontendRoot, 'src/components/task-runtime/TaskDetail.tsx')
const formPath = path.join(frontendRoot, 'src/components/task-runtime/DynamicTaskForm.tsx')
const historyPath = path.join(frontendRoot, 'src/components/task-runtime/SubmissionHistoryCard.tsx')

const taskFixture = {
  task: {
    id: 21,
    title: '机房巡检',
    description: '按模板完成巡检记录',
    templateVersionId: 9,
    templateName: '巡检模板',
    plannedStartAt: '2026-08-14T09:00:00',
    dueAt: '2026-08-14T18:00:00',
    priority: 'high',
    executionStatus: 'changes_requested',
    approvalStatus: 'changes_requested',
    overdue: false,
    actions: {
      canStart: false,
      canEditDraft: true,
      canSubmit: true,
      canCancel: false,
      canReassign: false,
      canRemind: true,
      canViewSensitive: false,
    },
  },
  template: {
    id: 9,
    templateId: 3,
    version: 2,
    status: 'published',
    name: '巡检模板',
    description: '机房例行巡检',
    instructions: '填写巡检结果后提交。',
    layout: {},
    completionPolicy: {},
    defaultAssignment: {},
    defaultReminder: {},
    updatedAt: '2026-08-14T08:00:00',
    fields: [
      {
        key: 'result',
        label: '巡检结果',
        type: 'textarea',
        sortOrder: 1,
        required: true,
        validation: {},
        display: { placeholder: '填写巡检结果' },
        visibility: {},
        condition: {},
        formula: {},
        analytics: {},
        sensitive: false,
      },
    ],
  },
  draft: {
    taskId: 21,
    revision: 4,
    formData: { result: '温度正常' },
    attachments: [],
  },
  currentSubmission: {
    id: 88,
    taskId: 21,
    templateVersionId: 9,
    version: 1,
    status: 'changes_requested',
    effective: false,
    formData: { result: '温度正常' },
    attachments: [],
    submittedAt: '2026-08-14T10:00:00',
  },
  timeline: [{ id: 1, eventType: 'submitted', eventData: {}, createdAt: '2026-08-14T10:00:00' }],
  actions: {
    canStart: false,
    canEditDraft: true,
    canSubmit: true,
    canCancel: false,
    canReassign: false,
    canRemind: true,
    canViewSensitive: false,
  },
}

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
      return { useParams: () => ({ taskId: '21' }), useRouter: () => ({ push() {} }), usePathname: () => '/tasks/21' }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/lib/api-error') return { getApiErrorMessage: () => 'error' }
    if (request === '@/lib/approval-api') {
      return {
        approvalActionLabel: (action) => action,
        listTaskApprovalRounds: async () => [],
      }
    }
    if (request === '@/lib/task-runtime-api') {
      return {
        getTask: async () => taskFixture,
        previewAggregateReferences: async () => [],
        listTaskSubmissions: async () => [taskFixture.currentSubmission],
        getTaskSubmissionDiff: async () => ({ changes: {} }),
        downloadTaskSubmissionAttachment: async () => undefined,
        startTask: async () => ({}),
        remindTask: async () => ({}),
        saveTaskDraft: async () => taskFixture.draft,
        validateTask: async () => ({ valid: true, issues: [] }),
        submitTask: async () => ({}),
        uploadTaskAttachment: async () => ({}),
        deleteTaskAttachment: async () => ({}),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey }) => {
          if (Array.isArray(queryKey) && queryKey[0] === 'task' && queryKey[2] === 'aggregate-references') {
            return { data: [], isLoading: false, isError: false, refetch() {} }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'task') {
            return { data: taskFixture, isLoading: false, isError: false, refetch() {} }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'task-approval-rounds') {
            return {
              data: [
                {
                  id: 3,
                  roundNumber: 1,
                  status: 'changes_requested',
                  startedAt: '2026-08-14T10:05:00',
                  endedAt: '2026-08-14T11:00:00',
                  actions: [
                    {
                      id: 7,
                      action: 'return_for_changes',
                      nodeName: '值班长',
                      comment: '请补充机柜编号',
                      createdAt: '2026-08-14T11:00:00',
                      fieldComments: [{ fieldKey: 'result', severity: 'error', comment: '结果不够具体' }],
                      attachmentComments: [],
                    },
                  ],
                },
              ],
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'task-submissions') {
            return { data: [taskFixture.currentSubmission], isLoading: false, isError: false, refetch() {} }
          }
          return { data: undefined, isLoading: false, isError: false, refetch() {} }
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

test('task detail leaves old visual entries and keeps runtime APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const detail = fs.readFileSync(detailPath, 'utf8')
  const form = fs.readFileSync(formPath, 'utf8')
  const history = fs.readFileSync(historyPath, 'utf8')
  assert.match(detail, /DetailDrawerPage/)
  assert.match(detail, /figma-neutral\/index\.css/)
  assert.match(detail, /queryKey: \['task', taskId\]/)
  assert.match(detail, /queryKey: \['task', taskId, 'aggregate-references'\]/)
  assert.match(detail, /queryKey: \['task-approval-rounds', taskId\]/)
  assert.match(detail, /startTask/)
  assert.match(detail, /remindTask/)
  assert.match(detail, /saveTaskDraft/)
  assert.match(detail, /validateTask/)
  assert.match(detail, /submitTask/)
  assert.match(detail, /uploadTaskAttachment/)
  assert.match(detail, /deleteTaskAttachment/)
  assert.match(detail, /1500/)
  assert.match(detail, /submissionIdempotencyKey/)
  assert.match(history, /queryKey: \['task-submissions', taskId\]/)
  assert.match(history, /queryKey: \['task-submission-diff', taskId, selected\?\.id, selected\?\.supersedesSubmissionId\]/)
  assert.match(page, /TaskDetail/)
  assert.doesNotMatch(detail, /@\/components\/design-system/)
  assert.doesNotMatch(detail, /@\/components\/shared/)
  assert.doesNotMatch(form, /@\/components\/design-system/)
  assert.doesNotMatch(history, /@\/components\/design-system/)
  assert.doesNotMatch(detail, /text-v2-/)
  assert.doesNotMatch(form, /text-v2-/)
  assert.doesNotMatch(history, /text-v2-/)
})

test('task detail renders Neutral detail composition and return-reason status', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /机房巡检/)
  assert.match(html, /巡检模板/)
  assert.match(html, /巡检结果/)
  assert.match(html, /审批已退回/)
  assert.match(html, /请补充机柜编号/)
  assert.match(html, /保存草稿|已保存/)
  assert.match(html, /重新提交/)
  assert.match(html, /任务信息/)
  assert.match(html, /时间线/)
  assert.match(html, /历史提交与差异/)
  assert.doesNotMatch(html, /<main/)
})
