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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/change-docs/new/page.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {}, back() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') {
      return { get: async () => ({ data: { data: [] } }), post: async () => ({ data: { data: { id: 1 } } }) }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: () => ({
          data: [{
            id: 3,
            name: '网络变更申请单',
            description: '网络变更',
            active: true,
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
          }],
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
      const hit = [resolved, resolved + '.tsx', resolved + '.ts', resolved + '/index.ts', resolved + '/index.tsx'].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
      if (hit) return loadCompiled(hit)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [resolved + '.tsx', resolved + '.ts', resolved].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
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

function assertNoLegacy(source) {
  assert.doesNotMatch(source, /@\/components\/design-system/)
  assert.doesNotMatch(source, /@\/components\/shared/)
  assert.doesNotMatch(source, /text-v2-/)
  assert.doesNotMatch(source, /border-v2-/)
}

test('change-docs new leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['change-doc-templates-active'\]/)
  assert.match(page, /\/admin\/change-doc-templates/)
  assert.match(page, /\/change-docs\/ai-generate-new/)
  assert.match(page, /api\.post\('\/change-docs'/)
  assert.match(page, /hasPermission\('change_doc', 'create'\)/)
  assertNoLegacy(page)
  assertNoLegacy(fs.readFileSync(path.join(frontendRoot, 'src/app/(dashboard)/change-docs/new/components/TemplateSelector.tsx'), 'utf8'))
  assertNoLegacy(fs.readFileSync(path.join(frontendRoot, 'src/app/(dashboard)/change-docs/new/components/CiSelectorModal.tsx'), 'utf8'))
  assertNoLegacy(fs.readFileSync(path.join(frontendRoot, 'src/components/change-doc/FieldList.tsx'), 'utf8'))
  assertNoLegacy(fs.readFileSync(path.join(frontendRoot, 'src/components/change-doc/TableFieldEditor.tsx'), 'utf8'))
})

test('change-docs new renders Neutral template step', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /新建变更文档/)
  assert.match(html, /选择申请单模板/)
  assert.match(html, /网络变更申请单/)
  assert.match(html, /下一步：填写内容/)
})
