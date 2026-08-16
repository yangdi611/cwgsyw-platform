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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/page.tsx')
const listPath = path.join(frontendRoot, 'src/components/task-runtime/TaskList.tsx')
const detailPath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/[taskId]/page.tsx')
const dialogPath = path.join(frontendRoot, 'src/components/task-runtime/OneOffTaskDialog.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ push() {}, replace() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@tanstack/react-query') {
      return {
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey }) => {
          if (Array.isArray(queryKey) && queryKey[0] === 'one-off-templates') {
            return { data: [{ id: 1, name: '巡检模板', latestVersionId: 9 }], isLoading: false }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'one-off-users') {
            return { data: [{ id: 4, username: 'ops', realName: '运维甲' }], isLoading: false }
          }
          return {
            data: {
              records: [
                {
                  id: 21,
                  title: '机房巡检',
                  templateName: '巡检模板',
                  executionStatus: 'in_progress',
                  approvalStatus: 'pending',
                  dueAt: '2026-08-14T18:00:00',
                  priority: 'high',
                  overdue: false,
                },
              ],
              total: 1,
            },
            isLoading: false,
            isError: false,
            refetch() {},
          }
        },
      }
    }
    if (request === '@/hooks/usePermission') {
      return { usePermission: () => ({ hasPermission: () => true }) }
    }
    if (request === '@/lib/task-runtime-api') return { listTasks: async () => ({ records: [], total: 0 }) }
    if (request === '@/components/task-runtime/OneOffTaskDialog') return { OneOffTaskDialog: () => null }
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

test('tasks page leaves old visual entries and keeps task list APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const list = fs.readFileSync(listPath, 'utf8')
  const detail = fs.readFileSync(detailPath, 'utf8')
  const dialog = fs.readFileSync(dialogPath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(list, /DataManagementPage/)
  assert.match(list, /queryKey: \['tasks', \{ page, keyword, scope, status \}\]/)
  assert.match(list, /listTasks/)
  assert.match(list, /OneOffTaskDialog/)
  assert.match(dialog, /NeutralDialog/)
  assert.match(dialog, /queryKey: \['one-off-templates'\]/)
  assert.match(dialog, /queryKey: \['one-off-users'\]/)
  assert.match(dialog, /createOneOffTask/)
  assert.doesNotMatch(list, /@\/components\/design-system/)
  assert.doesNotMatch(list, /@\/components\/shared/)
  assert.doesNotMatch(dialog, /@\/components\/design-system/)
  assert.match(detail, /TaskDetail/)
})

test('tasks page renders Neutral table and scope chips', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /我的任务/)
  assert.match(html, /机房巡检/)
  assert.match(html, /进行中/)
  assert.match(html, /我的组/)
  assert.doesNotMatch(html, /<main/)
})

test('one-off dialog renders Neutral fields without old overlay entries', () => {
  const dialog = fs.readFileSync(dialogPath, 'utf8')
  assert.match(dialog, /<NeutralDialog/)
  assert.match(dialog, /快速创建一次性任务/)
  assert.match(dialog, /任务标题/)
  assert.match(dialog, /选择已发布模板/)
  assert.match(dialog, /选择执行人/)
  assert.doesNotMatch(dialog, /rounded-v2/)
})
