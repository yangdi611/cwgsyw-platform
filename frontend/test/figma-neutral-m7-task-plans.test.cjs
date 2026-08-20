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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/plans/page.tsx')
const listPath = path.join(frontendRoot, 'src/components/task-plan/TaskPlanList.tsx')

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
    if (request === 'next/link') return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true }) }
    if (request === '@/lib/task-plan-api') {
      return { listTaskPlans: async () => ({ records: [], total: 0 }), changeTaskPlanStatus: async () => ({}) }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: () => ({
          data: {
            records: [
              {
                id: 12,
                name: '机房日报',
                description: '每日机房巡检计划',
                templateVersionId: 9,
                templateName: '巡检模板',
                scheduleType: 'daily',
                generationMode: 'per_user',
                status: 'active',
                nextGenerateAt: '2026-08-15T08:00:00',
              },
            ],
            total: 1,
          },
          isLoading: false,
          isError: false,
          refetch() {},
        }),
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

test('task plans page leaves old visual entries and keeps plan APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const list = fs.readFileSync(listPath, 'utf8')
  assert.match(page, /TaskPlanList/)
  assert.match(list, /DataManagementPage/)
  assert.match(list, /showBreadcrumb=\{false\}/)
  assert.match(list, /figma-neutral\/index\.css/)
  assert.match(list, /queryKey: \['task-plans', keyword, status\]/)
  assert.match(list, /listTaskPlans/)
  assert.match(list, /changeTaskPlanStatus/)
  assert.match(list, /task_plan/)
  assert.match(list, /NeutralTooltip/)
  assert.match(list, /followCursor/)
  assert.match(list, /搜索计划名称\.\.\./)
  assert.match(list, /cwgsyw-tasks-toolbar--split/)
  assert.match(list, /自定义周期/)
  assert.doesNotMatch(list, /FilterBar/)
  assert.doesNotMatch(list, /高级 Cron/)
  assert.doesNotMatch(list, /@\/components\/design-system/)
  assert.doesNotMatch(list, /@\/components\/shared/)
  assert.doesNotMatch(list, /text-v2-/)
})

test('task plans page renders Neutral table and status chips', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /任务计划/)
  assert.match(html, /机房日报/)
  assert.match(html, /运行中/)
  assert.match(html, /每日/)
  assert.match(html, /全部/)
  assert.match(html, /已暂停/)
  assert.match(html, /搜索计划名称/)
  assert.doesNotMatch(html, /<main/)
})
