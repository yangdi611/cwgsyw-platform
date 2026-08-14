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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/analytics/[dashboardId]/page.tsx')
const dashboardPath = path.join(frontendRoot, 'src/components/task-analytics/TaskAnalyticsDashboard.tsx')
const subscriptionsPath = path.join(frontendRoot, 'src/components/task-analytics/DashboardSubscriptions.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ push() {}, replace() {}, refresh() {} }) }
    if (request === 'next/link') return ({ children, href }) => React.createElement('a', { href }, children)
    if (request === 'next/image') return (props) => React.createElement('img', props)
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === 'recharts') {
      const box = ({ children }) => React.createElement('div', null, children)
      return {
        ResponsiveContainer: box, BarChart: box, LineChart: box, PieChart: box, Bar: () => null, Line: () => null,
        Pie: box, Cell: () => null, CartesianGrid: () => null, Tooltip: () => null, Legend: () => null, XAxis: () => null, YAxis: () => null,
      }
    }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true }) }
    if (request === '@/store/authStore') return { useAuthStore: (sel) => sel({ groupScope: 'tenant', groupId: 1 }) }
    if (request === '@/lib/task-plan-api') return { listDirectoryGroups: async () => [], listDirectoryUsers: async () => [] }
    if (request === '@/lib/task-analytics-api') {
      return {
        getAnalyticsDashboard: async () => ({}),
        listAnalyticsSubscriptions: async () => [],
        queryTaskAnalytics: async () => ({ rows: [], columns: [], scannedFacts: 0, generatedAt: '2026-08-14T10:00:00' }),
        shareAnalyticsDashboard: async () => ({}),
        deleteAnalyticsDashboard: async () => ({}),
        deleteAnalyticsWidget: async () => ({}),
        exportTaskAnalytics: async () => ({}),
        createAnalyticsSubscription: async () => ({}),
        deleteAnalyticsSubscription: async () => ({}),
        testAnalyticsSubscription: async () => ({}),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey }) => {
          if (queryKey[0] === 'task-analytics-dashboard') {
            return {
              data: { name: '巡检看板', description: '权限内实时计算', scopeType: 'private', canManage: true, widgets: [] },
              isLoading: false,
              isError: false,
              refetch() {},
            }
          }
          if (queryKey[0] === 'task-analytics-subscriptions') {
            return { data: [], isLoading: false, isError: false, refetch() {} }
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

test('task analytics dashboard leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const dashboard = fs.readFileSync(dashboardPath, 'utf8')
  const subscriptions = fs.readFileSync(subscriptionsPath, 'utf8')
  assert.match(page, /TaskAnalyticsDashboard/)
  assert.match(dashboard, /figma-neutral\/index\.css/)
  assert.match(dashboard, /queryKey: \['task-analytics-dashboard', dashboardId\]/)
  assert.match(dashboard, /getAnalyticsDashboard/)
  assert.match(dashboard, /shareAnalyticsDashboard/)
  assert.match(subscriptions, /queryKey: \['task-analytics-subscriptions', dashboardId\]/)
  for (const source of [dashboard, subscriptions]) {
    assert.doesNotMatch(source, /@\/components\/design-system/)
    assert.doesNotMatch(source, /@\/components\/shared/)
    assert.doesNotMatch(source, /text-v2-/)
    assert.doesNotMatch(source, /border-v2-/)
    assert.doesNotMatch(source, /bg-v2-/)
  }
})

test('task analytics dashboard renders Neutral empty board and subscriptions', () => {
  const dashboard = loadCompiled(dashboardPath)
  const html = renderToStaticMarkup(React.createElement(dashboard.TaskAnalyticsDashboard, { dashboardId: 8 }))
  assert.match(html, /巡检看板/)
  assert.match(html, /定时订阅/)
  assert.match(html, /看板暂无组件/)
})
