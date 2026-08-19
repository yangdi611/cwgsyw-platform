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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/automations/page.tsx')
const managerPath = path.join(frontendRoot, 'src/components/task-analytics/TaskAutomationsManager.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ push() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true }) }
    if (request === '@/lib/api-error') return { getApiErrorMessage: () => 'error' }
    if (request === '@/lib/task-plan-api') {
      return {
        listPublishedTemplates: async () => [{ name: '巡检模板', latestVersionId: 11 }],
        listDirectoryUsers: async () => [{ id: 2, username: 'ops', realName: '运维' }],
      }
    }
    if (request === '@/lib/task-analytics-api') {
      return {
        listTaskAutomations: async () => [],
        listTaskAutomationExecutions: async () => [],
        createTaskAutomation: async () => ({ id: 1 }),
        updateTaskAutomation: async () => ({}),
        changeTaskAutomationStatus: async () => ({}),
        deleteTaskAutomation: async () => ({}),
        previewTaskAutomation: async () => ({}),
        retryTaskAutomationExecution: async () => ({}),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false, data: undefined }),
        useQuery: ({ queryKey }) => {
          if (queryKey[0] === 'task-automations') {
            return {
              data: [{ id: 9, name: '审批后建单', status: 'draft', triggerType: 'submission_approved', actionType: 'create_task', description: '', triggerConfig: {}, conditionConfig: {}, actionConfig: {} }],
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (queryKey[0] === 'task-automation-templates') {
            return { data: [{ name: '巡检模板', latestVersionId: 11 }], isLoading: false, isError: false, refetch() {} }
          }
          if (queryKey[0] === 'task-automation-users') {
            return { data: [{ id: 2, username: 'ops', realName: '运维' }], isLoading: false, isError: false, refetch() {} }
          }
          return { data: [], isLoading: false, isError: false, refetch() {} }
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

test('task automations leave old visual entries and keep APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const manager = fs.readFileSync(managerPath, 'utf8')
  assert.match(page, /TaskAutomationsManager/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.doesNotMatch(manager, /DataManagementPage/)
  assert.doesNotMatch(manager, /<Card/)
  assert.match(manager, /overlay/)
  assert.match(manager, /AUTOMATION_STEPS/)
  assert.match(manager, /queryKey: \['task-automations'\]/)
  assert.match(manager, /queryKey: \['task-automation-templates'\]/)
  assert.match(manager, /queryKey: \['task-automation-users'\]/)
  assert.match(manager, /queryKey: \['task-automation-executions', selectedId\]/)
  assert.match(manager, /createTaskAutomation/)
  assert.match(manager, /previewTaskAutomation/)
  assert.match(manager, /changeTaskAutomationStatus/)
  assert.doesNotMatch(manager, /@\/components\/design-system/)
  assert.doesNotMatch(manager, /@\/components\/shared/)
  assert.doesNotMatch(manager, /text-v2-/)
  assert.doesNotMatch(manager, /border-v2-/)
})

test('task automations render Neutral workspace and existing rule', () => {
  const manager = loadCompiled(managerPath)
  const html = renderToStaticMarkup(React.createElement(manager.TaskAutomationsManager))
  assert.match(html, /任务自动化/)
  assert.match(html, /新建规则/)
  assert.match(html, /已有规则/)
  assert.match(html, /审批后建单/)
  assert.match(html, /创建草稿规则/)
  assert.match(html, /cwgsyw-cmdb-wizard-steps/)
  assert.doesNotMatch(html, /<main/)
  const createAt = html.indexOf('cwgsyw-tasks-section__title">新建规则')
  const existingAt = html.indexOf('cwgsyw-tasks-section__title">已有规则')
  assert.ok(createAt !== -1 && existingAt !== -1 && createAt < existingAt)
})
