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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/plans/new/page.tsx')
const editorPath = path.join(frontendRoot, 'src/components/task-plan/TaskPlanEditor.tsx')
const selectorPath = path.join(frontendRoot, 'src/components/task-plan/CiScopeSelector.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ push() {} }), useParams: () => ({}) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/lib/approval-api') {
      return { listPublishedApprovalSchemes: async () => [] }
    }
    if (request === '@/lib/task-plan-api') {
      return {
        createTaskPlan: async () => ({ id: 1 }),
        updateTaskPlan: async () => ({ id: 1 }),
        getTaskPlan: async () => ({}),
        listDirectoryGroups: async () => [],
        listDirectoryUsers: async () => [],
        listPublishedTemplates: async () => [],
        previewTaskPlan: async () => ({ occurrences: [], totalTaskCount: 0, warnings: [] }),
        listModelGroups: async () => [],
        listModels: async () => [],
        listInstances: async () => [],
        resolveCiScope: async () => ({ selections: [], total: 0, truncated: false, instances: [], warnings: [] }),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey, enabled }) => {
          if (enabled === false) return { data: undefined, isLoading: false, isError: false, refetch() {} }
          if (Array.isArray(queryKey) && queryKey[0] === 'task-plan-template-options') {
            return { data: [{ id: 3, name: '巡检模板', latestVersionId: 9 }], isLoading: false, isError: false, refetch() {} }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'task-plan-approval-options') {
            return { data: [{ latestVersionId: 4, name: '值班审批', latestVersion: { version: 1 } }], isLoading: false, isError: false, refetch() {} }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'task-plan-user-options') {
            return { data: [{ id: 8, username: 'ops', realName: '运维甲' }], isLoading: false, isError: false, refetch() {} }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'task-plan-group-options') {
            return { data: [{ id: 2, name: '网络组', code: 'net' }], isLoading: false, isError: false, refetch() {} }
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

test('new task plan page leaves old visual entries and keeps plan APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const editor = fs.readFileSync(editorPath, 'utf8')
  const selector = fs.readFileSync(selectorPath, 'utf8')
  assert.match(page, /TaskPlanEditor/)
  assert.match(editor, /FormSettingsPage/)
  assert.match(editor, /figma-neutral\/index\.css/)
  assert.match(editor, /queryKey: \['task-plan', planId\]/)
  assert.match(editor, /queryKey: \['task-plan-template-options'\]/)
  assert.match(editor, /queryKey: \['task-plan-approval-options'\]/)
  assert.match(editor, /queryKey: \['task-plan-user-options'\]/)
  assert.match(editor, /queryKey: \['task-plan-group-options'\]/)
  assert.match(editor, /createTaskPlan/)
  assert.match(editor, /updateTaskPlan/)
  assert.match(editor, /previewTaskPlan/)
  assert.match(selector, /queryKey: \['task-plan-ci-groups'\]/)
  assert.match(selector, /queryKey: \['task-plan-ci-models', groupCode\]/)
  assert.match(selector, /queryKey: \['task-plan-ci-instances', modelCode, keyword\]/)
  assert.match(selector, /queryKey: \['task-plan-ci-preview', value\]/)
  assert.doesNotMatch(editor, /@\/components\/design-system/)
  assert.doesNotMatch(editor, /@\/components\/shared/)
  assert.doesNotMatch(selector, /@\/components\/design-system/)
  assert.doesNotMatch(editor, /text-v2-/)
  assert.doesNotMatch(selector, /text-v2-/)
})

test('new task plan page renders Neutral form settings and first step', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /新建任务计划/)
  assert.match(html, /基础信息/)
  assert.match(html, /计划名称/)
  assert.match(html, /任务模板/)
  assert.match(html, /下一步/)
  assert.doesNotMatch(html, /<main/)
})
