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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/instances/by-model/[modelCode]/page.tsx')
const patternsPath = path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css')

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
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {}, back() {} }), useParams: () => ({ modelCode: 'server' }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/components/cmdb/CsvImportDialog') return { CsvImportDialog: () => null }
    if (request === '@/components/cmdb/BatchEditDialog') return { BatchEditDialog: () => null }
    if (request === '@/lib/cmdb-model-code') return { decodeModelCodeOnce: (value) => value }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') {
      return {
        get: async () => ({ data: { data: { records: [{ id: '1', name: '变更审批流', key: 'changeDocApproval', version: 2, category: '审批', activeVersion: 2 }], total: 1 } } }),
        put: async () => ({ data: {} }),
        post: async () => ({ data: {} }),
        delete: async () => ({ data: {} }),
      }
    }
    if (request === '@/lib/api-error') return { getApiErrorMessage: (_err, fallback) => fallback }
    if (request === '@/types/api') {
      return { extractPaginated: (r) => r.data.data }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: ({ queryKey } = {}) => {
          const key = String(queryKey || '')
          if (key.includes('cmdb-instances')) return { data: { records: [{ id: 11, modelId: 'server', name: 'web-01', status: 'running', owner: 'ops', description: '', fieldsData: { cpu_cores: 8 }, createdAt: '2026-08-14T00:00:00Z' }], total: 45 }, isLoading: false, isError: false, refetch() {} }
          if (key.includes('cmdb-model')) return { data: { name: '服务器', attributes: [{ fieldKey: 'cpu_cores', name: 'CPU 核数', isListShow: true, isDrawerShow: true, isEditable: true, fieldType: 'int', option: null }] } }
          return { data: undefined, isLoading: false }
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

test('cmdb instance list leaves old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['cmdb-instances', canonicalModelCode, page\]/)
  assert.match(page, /params: \{ model: canonicalModelCode, page, size: PAGE_SIZE \}/)
  assert.match(page, /<Pagination page=\{page\} pageCount=\{pageCount\} totalCount=\{total\} onPageChange=\{changePage\}/)
  assert.match(page, /const changePage = \(nextPage: number\)[\s\S]*setSelectedIds\(\[\]\)[\s\S]*setPage\(nextPage\)/)
  assert.match(page, /CsvImportDialog/)
  assert.match(page, /BatchEditDialog/)
  assert.match(page, /label="全选当前页实例"/)
  assert.match(page, /indeterminate=\{somePageSelected\}/)
  assert.match(page, /event\.target\.checked \? currentPageIds : \[\]/)
  assert.match(page, /label=\{`选择实例 \$\{item\.name/)
  assert.doesNotMatch(page, /取消选择|'选择'\}/)
  assert.match(page, /cmdb-admin__figma-action-icon--trash/)
  assert.match(page, /aria-label=\{`删除实例 \$\{item\.name/)
  assert.match(page, /className="cwgsyw-cmdb-model-detail__delete-dialog"/)
  assert.match(page, /cwgsyw-cmdb-model-detail__delete-alert-icon/)
  assert.match(page, /CmdbInstancePreview/)
  assert.match(page, /cwgsyw-cmdb-preview-drawer/)
  assert.match(page, /cwgsyw-cmdb-table/)
  assert.match(page, /cwgsyw-cmdb-instance-list__table--selectable/)
  assert.match(page, /cwgsyw-cmdb-instance-list/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.doesNotMatch(page, /<Breadcrumb|\bBreadcrumb,/)
  assert.equal((page.match(/<Button[^>]*size="sm"/g) ?? []).length >= 6, true)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-list :where\(\.cwgsyw-btn, \.cwgsyw-btn > span\)[\s\S]*font-weight: var\(--cwgsyw-font-weight-regular\)/)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-list \.cwgsyw-table[\s\S]*min-width: 100%[\s\S]*table-layout: fixed/)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-list__table--selectable :where\(\.cwgsyw-th, \.cwgsyw-td\):first-child[\s\S]*width: 44px/)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-list :where\(\.cwgsyw-th, \.cwgsyw-td\):last-child[\s\S]*width: 56px/)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-list__selection \.cwgsyw-choice input[\s\S]*width: 16px[\s\S]*height: 16px/)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-list \.cwgsyw-td:last-child \.cwgsyw-cmdb-admin__delete-action[\s\S]*color: var\(--cwgsyw-status-danger-fg\)/)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-list \.cwgsyw-td:last-child \.cwgsyw-inline-controls[\s\S]*flex-wrap: nowrap[\s\S]*justify-content: flex-end/)
  assert.match(patterns, /@media \(max-width: 430px\)[\s\S]*\.cwgsyw-cmdb-instance-list \.cwgsyw-table-mobile \.cwgsyw-card[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
})

test('cmdb instance list renders Neutral table', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /实例列表/)
  assert.match(html, /web-01/)
  assert.match(html, /aria-label="分页"/)
  assert.match(html, /aria-label="下一页"/)
})
