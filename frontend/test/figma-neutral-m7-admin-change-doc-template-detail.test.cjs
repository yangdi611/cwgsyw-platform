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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/admin/change-doc-templates/[id]/page.tsx')

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
    if (request === 'next/navigation') {
      return {
        useRouter: () => ({ replace() {}, push() {} }),
        useParams: () => ({ id: '3' }),
      }
    }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') return { get: async () => ({ data: { data: {} } }), put: async () => ({}), delete: async () => ({}) }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: () => ({
          data: {
            id: 3,
            name: '网络变更申请单',
            description: '网络变更',
            hasDocx: true,
            docType: 'application',
            fields: [{
              id: 1,
              fieldKey: 'title',
              label: '标题',
              fieldType: 'text',
              sortOrder: 10,
              required: true,
              inForm: true,
              placeholder: '请输入标题',
            }],
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

test('admin change-doc-template detail leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const css = fs.readFileSync(path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['change-doc-template', id\]/)
  assert.match(page, /\/admin\/change-doc-templates\/\$\{id\}/)
  assert.match(page, /\/admin\/change-doc-templates\/\$\{id\}\/fields/)
  assert.match(page, /\/admin\/change-doc-templates\/\$\{id\}\/fields\/\$\{fieldId\}/)
  assert.match(page, /showBreadcrumb=\{false\}/)
  assert.match(page, /cwgsyw-change-doc-template-fields__section/)
  assert.match(page, /size="sm"/)
  assert.match(page, /overlay/)
  assert.doesNotMatch(page, /<Breadcrumb/)
  assert.doesNotMatch(page, /<Card/)
  const editor = fs.readFileSync(path.join(frontendRoot, 'src/components/change-doc/TableConfigEditor.tsx'), 'utf8')
  assert.doesNotMatch(editor, /@\/components\/design-system/)
  assert.doesNotMatch(editor, /text-v2-/)
  assert.doesNotMatch(editor, /border-v2-/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.match(css, /\.cwgsyw-change-doc-template-fields__head \{/)
  assert.match(css, /min-height: 34px/)
  assert.match(css, /\.cwgsyw-change-doc-template-fields \.cwgsyw-choice input \{/)
  assert.match(css, /width: 16px/)
  assert.match(css, /\.cwgsyw-change-doc-template-fields \.cwgsyw-choice \.cwgsyw-type-label-sm \{/)
  assert.match(css, /font-weight: var\(--cwgsyw-font-weight-regular\)/)
})

test('admin change-doc-template detail renders Neutral field settings', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /网络变更申请单/)
  assert.match(html, /基本信息/)
  assert.match(html, /添加字段/)
  assert.match(html, /保存配置/)
  assert.match(html, /书签 Key/)
})
