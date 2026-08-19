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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/templates/new/page.tsx')
const createPath = path.join(frontendRoot, 'src/components/task-template/TaskTemplateCreate.tsx')

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
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/lib/api-error') return { getApiErrorMessage: () => 'error' }
    if (request === '@/lib/task-template-api') {
      return { createTaskTemplate: async () => ({ id: 3, versions: [{ id: 9, status: 'draft' }] }) }
    }
    if (request === '@tanstack/react-query') {
      return { useMutation: () => ({ mutate() {}, isPending: false }) }
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

test('new task template page leaves old visual entries and keeps create API', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const create = fs.readFileSync(createPath, 'utf8')
  assert.match(page, /TaskTemplateCreate/)
  assert.match(create, /FormSettingsPage/)
  assert.match(create, /TaskPanel/)
  assert.match(create, /cwgsyw-tasks-page--create/)
  assert.doesNotMatch(create, /<Card/)
  assert.match(create, /figma-neutral\/index\.css/)
  assert.match(create, /createTaskTemplate/)
  assert.match(create, /layout: \{ sections: \[\{ key: 'main', title: '任务内容', columns: 1 \}\] \}/)
  assert.match(create, /fields: \[\]/)
  assert.match(create, /\/tasks\/templates\/\$\{template\.id\}\/versions\/\$\{version\.id\}/)
  assert.doesNotMatch(create, /@\/components\/design-system/)
  assert.doesNotMatch(create, /@\/components\/shared/)
  assert.doesNotMatch(create, /text-v2-/)
})

test('new task template page renders Neutral form settings', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /新建模板/)
  assert.match(html, /模板编码/)
  assert.match(html, /模板名称/)
  assert.match(html, /创建并设计/)
  assert.doesNotMatch(html, /<main/)
})
