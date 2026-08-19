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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/notifications/page.tsx')
const itemPath = path.join(frontendRoot, 'src/components/notification/NotificationItem.tsx')
const resolvePath = path.join(frontendRoot, 'src/app/(dashboard)/notifications/targets/resolve/[notificationId]/page.tsx')

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
    if (request === 'next/link') {
      return { __esModule: true, default: ({ href, children }) => React.createElement('a', { href }, children) }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: () => ({
          data: {
            records: [
              {
                id: 7,
                title: '变更单已通过',
                content: 'CHG-12 已审批完成',
                type: 'change',
                refType: 'change_doc',
                refId: 12,
                isRead: false,
                createdAt: '2026-01-05T08:00:00Z',
              },
              {
                id: 8,
                title: '系统公告',
                content: '今晚维护',
                type: 'system',
                refType: null,
                refId: null,
                isRead: true,
                createdAt: '2026-01-04T08:00:00Z',
              },
            ],
            total: 2,
          },
          isLoading: false,
          isError: false,
          refetch() {},
        }),
      }
    }
    if (request === '@/lib/api') return { default: { get: async () => ({ data: { data: {} } }), post: async () => ({}) } }
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

test('notifications page and item leave old visual entries and keep APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const item = fs.readFileSync(itemPath, 'utf8')
  const resolve = fs.readFileSync(resolvePath, 'utf8')
  const css = fs.readFileSync(path.join(frontendRoot, 'src/components/notification/notifications.css'), 'utf8')
  const bell = fs.readFileSync(path.join(frontendRoot, 'public/figma-icons/notification-bell.svg'), 'utf8')
  assert.match(page, /DataManagementPage/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /components\/notification\/notifications\.css/)
  assert.match(page, /showEyebrow=\{false\}/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  const empty = fs.readFileSync(path.join(frontendRoot, 'src/components/notification/NotificationEmpty.tsx'), 'utf8')
  assert.match(empty, /notification-bell\.svg/)
  assert.match(empty, /6:23747/)
  assert.match(page, /queryKey: \['notifications'\]/)
  assert.match(page, /\/notifications\/\$\{id\}\/read/)
  assert.match(page, /\/notifications\/read-all/)
  assert.match(item, /cwgsyw-notifications-item/)
  assert.match(item, /\/notifications\/targets\/resolve\/\$\{notificationId\}/)
  assert.doesNotMatch(item, /cwgsyw-card/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(item, /@\/components\/design-system/)
  assert.doesNotMatch(item, /bg-blue-/)
  assert.doesNotMatch(item, /text-v2-/)
  assert.match(resolve, /figma-neutral\/index\.css/)
  assert.match(resolve, /DetailDrawerPage/)
  assert.doesNotMatch(resolve, /@\/components\/design-system/)
  assert.match(css, /\.cwgsyw-notifications-panel/)
  assert.match(css, /box-shadow: inset 2px 0 0 var\(--cwgsyw-neutral-900\)/)
  assert.match(css, /\.cwgsyw-notifications-item--unread \.cwgsyw-badge[\s\S]*background: var\(--cwgsyw-neutral-900\)/)
  assert.match(bell, /<svg/)
  const crumbs = fs.readFileSync(path.join(frontendRoot, 'src/lib/breadcrumb-config.ts'), 'utf8')
  assert.match(crumbs, /pattern: '\/notifications\/targets\/resolve\/:id'/)
  assert.match(crumbs, /label: '目标解析'/)
  assert.match(crumbs, /label: '目标详情'/)
})

test('notifications page renders Neutral unread and read items', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /通知中心/)
  assert.match(html, /1 条未读通知/)
  assert.match(html, /变更单已通过/)
  assert.match(html, /系统公告/)
  assert.match(html, /未读/)
  assert.match(html, /已读/)
  assert.match(html, /cwgsyw-notifications-item--unread/)
  assert.match(html, /\/notifications\/targets\/resolve\/7/)
  assert.doesNotMatch(html, /<main/)
  assert.doesNotMatch(html, /系统管理/)
})
