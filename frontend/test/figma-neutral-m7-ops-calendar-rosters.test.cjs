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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/ops-calendar/rosters/page.tsx')
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

function loadCompiled(filePath) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') return { useRouter: () => ({ push() {}, replace() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey }) => {
          if (Array.isArray(queryKey) && queryKey[0] === 'calendar-settings-rosters') {
            return {
              data: [
                {
                  id: 5,
                  dutyDate: '2026-08-14',
                  startAt: '2026-08-14T09:00:00',
                  endAt: '2026-08-14T18:00:00',
                  shiftName: '白班',
                  assigneeId: 2,
                  assigneeName: '张三',
                  assigneePhone: null,
                  backupAssigneeId: null,
                  backupAssigneeName: null,
                  phoneOverride: null,
                  groupId: 3,
                  groupName: '主机组',
                  groupArchived: false,
                  remark: '值班',
                  updatedBy: 1,
                  updatedAt: '2026-08-13T10:00:00',
                },
              ],
              isLoading: false,
            }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'ops-users-min') {
            return { data: [{ id: 2, realName: '张三', username: 'zhang' }], isLoading: false }
          }
          if (Array.isArray(queryKey) && queryKey[0] === 'calendar-settings-groups') {
            return { data: [{ id: 3, name: '主机组' }], isLoading: false }
          }
          return { data: [], isLoading: false }
        },
      }
    }
    if (request === '@/hooks/usePermission') {
      return { usePermission: () => ({ hasPermission: () => true }) }
    }
    if (request === '@/lib/task-plan-api') return { listDirectoryGroups: async () => [] }
    if (request === '@/lib/api') {
      return { default: { get: async () => ({ data: { data: [] } }), post: async () => ({}), put: async () => ({}), delete: async () => ({}) } }
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

test('rosters page leaves old visual entries and keeps roster APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const home = fs.readFileSync(homePath, 'utf8')
  assert.match(page, /DataManagementPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['calendar-settings-rosters', from, to\]/)
  assert.match(page, /\/calendar-settings\/rosters/)
  assert.match(page, /check-conflicts/)
  assert.match(page, /DateInput/)
  const patterns = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(patterns, /\.cwgsyw-dialog:has\(\.cwgsyw-ops-dialog\) \{[\s\S]*overflow-x: hidden/)
  assert.match(page, /type="time"/)
  assert.doesNotMatch(page, /datetime-local/)
  assert.doesNotMatch(page, /confirm\(/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(home, /@\/components\/design-system/)
})

test('rosters page renders Neutral table and missing-phone status', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /排班管理/)
  assert.match(html, /白班/)
  assert.match(html, /张三/)
  assert.match(html, /缺手机号/)
  assert.doesNotMatch(html, /<main/)
})
