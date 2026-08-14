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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/analytics/page.tsx')
const workbenchPath = path.join(frontendRoot, 'src/components/task-analytics/TaskAnalyticsWorkbench.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ push() {}, refresh() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true }) }
    if (request === '@/lib/api-error') return { getApiErrorMessage: () => 'error' }
    if (request === '@/lib/task-template-api') {
      return { listTaskTemplates: async () => ({ records: [] }) }
    }
    if (request === '@/lib/task-analytics-api') {
      return {
        listAnalyticsFields: async () => [],
        listAnalyticsDimensions: async () => [],
        queryTaskAnalytics: async () => ({ columns: [], rows: [], scannedFacts: 0, generatedAt: '2026-08-14T10:00:00' }),
        listAnalyticsDashboards: async () => [],
        createAnalyticsDashboard: async () => ({ id: 1 }),
        addAnalyticsWidget: async () => ({}),
        exportTaskAnalytics: async () => ({}),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {}, setQueryData() {} }),
        useQuery: ({ queryKey }) => {
          if (queryKey[0] === 'task-analytics-templates') {
            return { data: { records: [{ name: '巡检模板', latestVersionId: 11 }] }, isLoading: false, isError: false, refetch() {} }
          }
          if (queryKey[0] === 'task-analytics-fields') {
            return { data: [{ key: 'room', label: '机房', aggregations: ['count'], defaultAggregation: 'count', unit: '' }], isLoading: false, isError: false, refetch() {} }
          }
          if (queryKey[0] === 'task-analytics-dimensions') {
            return { data: [{ key: 'business_date', label: '业务日期' }], isLoading: false, isError: false, refetch() {} }
          }
          if (queryKey[0] === 'task-analytics-dashboards') {
            return { data: [{ id: 8, name: '巡检看板', scopeType: 'private' }], isLoading: false, isError: false, refetch() {} }
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

test('task analytics workbench leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const workbench = fs.readFileSync(workbenchPath, 'utf8')
  assert.match(page, /TaskAnalyticsWorkbench/)
  assert.match(workbench, /DataManagementPage/)
  assert.match(workbench, /figma-neutral\/index\.css/)
  assert.match(workbench, /queryKey: \['task-analytics-templates'\]/)
  assert.match(workbench, /queryKey: \['task-analytics-fields', effectiveTemplateVersionId\]/)
  assert.match(workbench, /queryKey: \['task-analytics-dimensions'\]/)
  assert.match(workbench, /queryKey: \['task-analytics-query', request\]/)
  assert.match(workbench, /queryKey: \['task-analytics-dashboards'\]/)
  assert.match(workbench, /createAnalyticsDashboard/)
  assert.match(workbench, /exportTaskAnalytics/)
  assert.doesNotMatch(workbench, /@\/components\/design-system/)
  assert.doesNotMatch(workbench, /@\/components\/shared/)
  assert.doesNotMatch(workbench, /text-v2-/)
})

test('task analytics workbench renders Neutral query workspace and dashboards', () => {
  const workbench = loadCompiled(workbenchPath)
  const html = renderToStaticMarkup(React.createElement(workbench.TaskAnalyticsWorkbench))
  assert.match(html, /任务统计/)
  assert.match(html, /查询条件/)
  assert.match(html, /巡检看板/)
  assert.match(html, /运行统计/)
  assert.doesNotMatch(html, /<main/)
})
