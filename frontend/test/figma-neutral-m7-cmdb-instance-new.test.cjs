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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/cmdb/instances/by-model/[modelCode]/new/page.tsx')
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
          if (key.includes('cmdb-instances')) return { data: { records: [{ id: 11, modelId: 'server', name: 'web-01', status: 'running', owner: 'ops', description: '', fieldsData: { cpu_cores: 8 }, createdAt: '2026-08-14T00:00:00Z' }], total: 1 }, isLoading: false, isError: false, refetch() {} }
          if (key.includes('cmdb-model')) return { data: { name: '服务器', attributeGroups: [{ groupId: 'hardware', name: '硬件信息', sortOrder: 1 }], attributes: [{ fieldKey: 'cpu_cores', name: 'CPU 核数', groupId: 'hardware', isRequired: true, isListShow: true, isDrawerShow: true, isEditable: true, fieldType: 'int', option: null }, { fieldKey: 'environment', name: '环境', groupId: 'hardware', isRequired: false, fieldType: 'enum', option: [{ id: 'prod', name: '生产' }] }] } }
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

test('cmdb new instance leaves old visual entries', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const patterns = fs.readFileSync(patternsPath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /api.post\('\/cmdb\/instances'/)
  assert.match(page, /cwgsyw-cmdb-instance-create/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.doesNotMatch(page, /<Breadcrumb|\bBreadcrumb,/)
  assert.doesNotMatch(page, /<Card|\bCard,/)
  assert.match(page, /state=\{showValidation && !name\.trim\(\) \? 'error' : 'default'\}/)
  assert.match(page, /missingRequiredKeys/)
  assert.match(page, /isError \? \(/)
  assert.match(page, /<ErrorState/)
  assert.match(page, /<Select size="sm" overlay/)
  assert.match(page, /<Textarea size="sm"/)
  assert.equal((page.match(/<Button[^>]*size="sm"/g) ?? []).length, 3)
  assert.equal((page.match(/cwgsyw-cmdb-instance-create__section-body/g) ?? []).length, 2)
  assert.match(page, /cwgsyw-cmdb-instance-create__multi-options/)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-create__section \{[\s\S]*overflow: hidden;[\s\S]*border: var\(--cwgsyw-border-width-default\) solid var\(--cwgsyw-border-default\);[\s\S]*border-radius: var\(--cwgsyw-radius-md\)/)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-create__section-title \{[\s\S]*min-height: 34px;[\s\S]*background: var\(--cwgsyw-bg-surface-subtle\);[\s\S]*font-weight: var\(--cwgsyw-font-weight-regular\)/)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-create__section-body \{[\s\S]*container: cwgsyw-instance-create-fields \/ inline-size;[\s\S]*padding: var\(--cwgsyw-space-3\)/)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-create__field-grid \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(patterns, /@container cwgsyw-instance-create-fields \(min-width: 560px\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(patterns, /@container cwgsyw-instance-create-fields \(min-width: 900px\)[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(patterns, /@container cwgsyw-instance-create-fields \(min-width: 1200px\)[\s\S]*repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(patterns, /\.cwgsyw-cmdb-instance-create__multi-options \.cwgsyw-choice input \{[\s\S]*width: 16px;[\s\S]*height: 16px/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
})

test('cmdb new instance renders Neutral form', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /新建/)
  assert.match(html, /实例名称/)
  assert.match(html, /硬件信息/)
  assert.match(html, /CPU 核数/)
  assert.match(html, /aria-haspopup="listbox"/)
})
