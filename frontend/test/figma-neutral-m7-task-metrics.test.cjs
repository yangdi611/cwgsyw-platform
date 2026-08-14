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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/metrics/page.tsx')
const managerPath = path.join(frontendRoot, 'src/components/task-analytics/TaskMetricsManager.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ push() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true }) }
    if (request === '@/lib/api-error') return { getApiErrorMessage: () => 'error' }
    if (request === '@/lib/task-plan-api') return { listDirectoryGroups: async () => [], listDirectoryUsers: async () => [] }
    if (request === '@/lib/task-template-api') return { listTaskTemplates: async () => ({ records: [] }), getTaskTemplateVersion: async () => ({ fields: [] }) }
    if (request === '@/lib/task-analytics-api') {
      return {
        listTaskMetrics: async () => [],
        listTaskMetricGoals: async () => [],
        createTaskMetric: async () => ({ id: 1 }),
        updateTaskMetric: async () => ({}),
        deleteTaskMetric: async () => ({}),
        addTaskMetricBinding: async () => ({}),
        updateTaskMetricBinding: async () => ({}),
        deleteTaskMetricBinding: async () => ({}),
        createTaskMetricGoal: async () => ({}),
        updateTaskMetricGoal: async () => ({}),
        deleteTaskMetricGoal: async () => ({}),
        previewTaskMetric: async () => ({}),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey }) => {
          if (queryKey[0] === 'task-metrics') {
            return { data: [{ id: 4, code: 'inspect_count', name: '巡检次数', aggregation: 'sum', valueType: 'count', unit: '次', authorityPolicy: { sourceRole: 'fact' }, bindings: [] }], isLoading: false, isError: false, refetch() {} }
          }
          if (queryKey[0] === 'task-metric-goals') return { data: [], isLoading: false, isError: false, refetch() {} }
          if (queryKey[0] === 'task-metric-templates') return { data: { records: [] }, isLoading: false, isError: false, refetch() {} }
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
      const hit = [resolved, `${resolved}.tsx`, `${resolved}.ts`, `${resolved}/index.ts`, `${resolved}/index.tsx`].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit) return loadCompiled(hit)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
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

test('task metrics leave old visual entries and keep APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const manager = fs.readFileSync(managerPath, 'utf8')
  assert.match(page, /TaskMetricsManager/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(manager, /queryKey: \['task-metrics'\]/)
  assert.match(manager, /queryKey: \['task-metric-goals'\]/)
  assert.match(manager, /createTaskMetric/)
  assert.match(manager, /previewTaskMetric/)
  assert.doesNotMatch(manager, /@\/components\/design-system/)
  assert.doesNotMatch(manager, /@\/components\/shared/)
  assert.doesNotMatch(manager, /text-v2-/)
  assert.doesNotMatch(manager, /border-v2-/)
})

test('task metrics render Neutral workspace and existing metric', () => {
  const manager = loadCompiled(managerPath)
  const html = renderToStaticMarkup(React.createElement(manager.TaskMetricsManager))
  assert.match(html, /指标与目标/)
  assert.match(html, /巡检次数/)
  assert.match(html, /指标定义/)
})
