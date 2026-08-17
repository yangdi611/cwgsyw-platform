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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/changes/page.tsx')

function compile(filePath) {
  return ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  }).outputText
}

function loadCompiled(filePath) {
  const compiled = compile(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {} }) }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') return { get: async () => ({ data: { data: { records: [], total: 0 } } }) }
    if (request === '@/components/cmdb/JsonDiffView') return { JsonDiffView: () => null }
    if (request === '@/components/cmdb/ChangeRecordItem') {
      return { actionMeta: (action) => ({ label: action || '操作' }) }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: ({ queryKey } = {}) => {
          if (queryKey?.[0] === 'cmdb-changes-v2') {
            return { data: { records: [{ id: 1, action: 'update_instance', operatorName: 'ops', summary: '改了名称', createdAt: '2026-08-14T00:00:00Z' }], total: 1 }, isLoading: false, isFetching: false }
          }
          if (queryKey?.[0] === 'cmdb-models-all') return { data: [] }
          return { data: undefined, isLoading: false, isFetching: false }
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

test('cmdb changes uses the scoped Neutral data-management composition', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /cmdb-changes-v2/)
  assert.match(page, /\/cmdb\/changes/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /lucide-react/)
  assert.match(page, /cwgsyw-cmdb-page cwgsyw-cmdb-changes/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.doesNotMatch(page, /<Breadcrumb/)
  assert.doesNotMatch(page, /cwgsyw-stack-list/)
  assert.match(page, /cwgsyw-cmdb-changes__mobile-list/)
  assert.match(page, /cwgsyw-cmdb-changes__diff/)
})

test('cmdb changes exposes filters and query states accessibly', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /aria-label="搜索变更记录"/)
  assert.match(page, /aria-label="按模型筛选"/)
  assert.match(page, /aria-label="开始日期"/)
  assert.match(page, /aria-label="结束日期"/)
  assert.match(page, /aria-label="按操作人 ID 筛选"/)
  assert.match(page, /aria-label="按动作筛选"/)
  assert.match(page, /aria-label="每页条数"/)
  assert.match(page, /无权查看变更历史/)
  assert.match(page, /模型筛选项加载失败/)
  assert.match(page, /变更历史加载失败/)
  assert.match(page, /日期范围无效/)
  assert.match(page, /没有符合筛选条件的记录/)
})

test('cmdb changes renders Neutral table', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /变更历史/)
  assert.match(html, /改了名称/)
  assert.match(html, /搜索变更记录/)
  assert.equal((html.match(/aria-label="面包屑"/g) ?? []).length, 0)
})
