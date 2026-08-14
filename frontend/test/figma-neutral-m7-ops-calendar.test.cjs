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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/ops-calendar/page.tsx')
const monthPath = path.join(frontendRoot, 'src/components/ops-calendar/CalendarMonthView.tsx')
const weekPath = path.join(frontendRoot, 'src/components/ops-calendar/CalendarWeekView.tsx')
const listPath = path.join(frontendRoot, 'src/components/ops-calendar/CalendarListView.tsx')
const dayPath = path.join(frontendRoot, 'src/components/ops-calendar/DayWorkItemsDialog.tsx')
const homePath = path.join(frontendRoot, 'src/app/(dashboard)/page.tsx')

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

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function loadCompiled(filePath) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') {
      return {
        useRouter: () => ({ push() {}, replace() {} }),
        useSearchParams: () => ({ get: () => null }),
      }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: ({ queryKey }) => {
          if (Array.isArray(queryKey) && queryKey[0] === 'calendar-work-items') {
            return {
              data: [
                {
                  itemType: 'task',
                  id: 'task-9',
                  title: '机房巡检',
                  startAt: `${today()}T09:00:00`,
                  endAt: `${today()}T10:00:00`,
                  status: 'in_progress',
                  overdue: false,
                  href: '/tasks/9',
                  meta: { assigneeName: 'admin' },
                },
              ],
              isLoading: false,
            }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'calendar-template-options') {
            return { data: [{ id: 1, name: '日报' }], isLoading: false }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'calendar-user-options') {
            return { data: [{ id: 2, realName: '张三', username: 'zhang' }], isLoading: false }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'calendar-group-options') {
            return { data: [{ id: 3, name: '主机组' }], isLoading: false }
          }
          return { data: undefined, isLoading: false }
        },
      }
    }
    if (request === '@/hooks/usePermission') {
      return { usePermission: () => ({ hasPermission: () => true }) }
    }
    if (request === '@/store/authStore') {
      return { useAuthStore: (selector) => selector({ groupScope: 'platform' }) }
    }
    if (request === '@/lib/task-plan-api') {
      return { listPublishedTemplates: async () => [], listDirectoryUsers: async () => [], listDirectoryGroups: async () => [] }
    }
    if (request === '@/lib/calendar-api') {
      return {
        listCalendarWorkItems: async () => [],
        getCalendarDay: async () => ({ date: today(), summary: { total: 0, pending: 0, overdue: 0, completed: 0 }, items: [] }),
        calendarItemDate: (item) => item.startAt.slice(0, 10),
        calendarItemTypeLabel: (type) => ({ task: '任务', roster: '排班', holiday: '节假日' })[type],
        calendarStatusLabel: (status) => status,
        calendarMetaText: (item, key) => item.meta?.[key] ?? '',
      }
    }
    if (request === '@/components/task-runtime/OneOffTaskDialog') {
      return { OneOffTaskDialog: () => null }
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

test('ops calendar page and views leave old visual entries and keep calendar APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const month = fs.readFileSync(monthPath, 'utf8')
  const week = fs.readFileSync(weekPath, 'utf8')
  const list = fs.readFileSync(listPath, 'utf8')
  const day = fs.readFileSync(dayPath, 'utf8')
  const home = fs.readFileSync(homePath, 'utf8')
  assert.match(page, /DataManagementPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['calendar-work-items'/)
  assert.match(page, /listCalendarWorkItems/)
  assert.match(page, /OneOffTaskDialog/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(month, /@\/components\/design-system/)
  assert.doesNotMatch(week, /@\/components\/design-system/)
  assert.doesNotMatch(list, /@\/components\/design-system/)
  assert.doesNotMatch(day, /@\/components\/design-system/)
  assert.doesNotMatch(month, /calendarItemColor/)
  assert.doesNotMatch(week, /calendarItemColor/)
  assert.doesNotMatch(home, /@\/components\/design-system/)
})

test('ops calendar renders Neutral month workspace and work item', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /运维日历/)
  assert.match(html, /机房巡检/)
  assert.match(html, /月/)
  assert.match(html, /周/)
  assert.match(html, /列表/)
  assert.doesNotMatch(html, /<main/)
})
