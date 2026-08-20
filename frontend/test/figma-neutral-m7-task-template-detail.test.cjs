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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/tasks/templates/[templateId]/page.tsx')
const detailPath = path.join(frontendRoot, 'src/components/task-template/TaskTemplateDetail.tsx')

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

function templateDetail(overrides = {}) {
  return {
    id: 7,
    name: '巡检模板',
    code: 'inspect',
    description: '机房巡检',
    status: 'published',
    builtin: true,
    scopeType: 'tenant',
    versions: [
      { id: 11, version: 1, name: '首发', status: 'published', updatedAt: '2026-08-14T10:00:00' },
    ],
    ...overrides,
  }
}

function loadCompiled(filePath, template = templateDetail()) {
  const compiled = compileTs(filePath)
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.endsWith('.css')) return {}
    if (request === 'next/navigation') return { useRouter: () => ({ push() {} }) }
    if (request === 'sonner' || request === '@/design-system/figma-neutral/toast') return { toast: { success() {}, error() {}, warning() {}, info() {}, message() {} }, NeutralToaster() { return null } }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true }) }
    if (request === '@/hooks/useBreadcrumbLabel') return { useBreadcrumbLabel() {} }
    if (request === '@/lib/api-error') return { getApiErrorMessage: () => 'error' }
    if (request === '@/lib/task-template-api') {
      return { getTaskTemplate: async () => template, createTaskTemplateDraft: async () => ({ id: 2, version: 2 }) }
    }
    if (request === '@tanstack/react-query') {
      return {
        useQueryClient: () => ({ invalidateQueries() {} }),
        useMutation: () => ({ mutate() {}, isPending: false }),
        useQuery: () => ({
          data: template,
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
      if (hit) return loadCompiled(hit, template)
    }
    if ((request.startsWith('./') || request.startsWith('../')) && parent && parent.filename) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`, resolved].find(
        (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
      )
      if (hit && (hit.endsWith('.ts') || hit.endsWith('.tsx'))) return loadCompiled(hit, template)
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

test('task template detail leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  const detail = fs.readFileSync(detailPath, 'utf8')
  assert.match(page, /TaskTemplateDetail/)
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(detail, /TaskPanel/)
  assert.doesNotMatch(detail, /<Card/)
  assert.doesNotMatch(detail, /DetailDrawerPage/)
  assert.match(detail, /showSubtitle=\{false\}/)
  assert.match(detail, /figma-neutral\/index\.css/)
  assert.match(detail, /queryKey: \['task-template', templateId\]/)
  assert.match(detail, /getTaskTemplate/)
  assert.match(detail, /createTaskTemplateDraft/)
  assert.match(detail, /\/tasks\/templates\/\$\{templateId\}\/versions\//)
  assert.doesNotMatch(detail, /@\/components\/design-system/)
  assert.doesNotMatch(detail, /@\/components\/shared/)
  assert.doesNotMatch(detail, /text-v2-/)
})

test('task template detail renders Neutral detail composition and builtin alert', () => {
  const detail = loadCompiled(detailPath)
  const html = renderToStaticMarkup(React.createElement(detail.TaskTemplateDetail, { templateId: 7 }))
  assert.match(html, /巡检模板/)
  assert.match(html, /已发布/)
  assert.match(html, /内置模板保持只读/)
  assert.match(html, /版本历史/)
  assert.match(html, /系统内置/)
  assert.doesNotMatch(html, /创建下一草稿版本/)
  assert.doesNotMatch(html, /<main/)
})

test('task template detail continues an existing draft version', () => {
  const detail = loadCompiled(detailPath, templateDetail({
    builtin: false,
    status: 'draft',
    versions: [
      { id: 21, version: 2, name: '下一版', status: 'draft', updatedAt: '2026-08-14T12:00:00' },
    ],
  }))
  const html = renderToStaticMarkup(React.createElement(detail.TaskTemplateDetail, { templateId: 7 }))
  assert.match(html, /继续设计 v2/)
  assert.match(html, /草稿/)
  assert.doesNotMatch(html, /内置模板保持只读/)
  assert.doesNotMatch(html, /创建下一草稿版本/)
})

test('task template detail offers next draft for tenant templates without one', () => {
  const detail = loadCompiled(detailPath, templateDetail({
    builtin: false,
    status: 'published',
  }))
  const html = renderToStaticMarkup(React.createElement(detail.TaskTemplateDetail, { templateId: 7 }))
  assert.match(html, /创建下一草稿版本/)
  assert.doesNotMatch(html, /内置模板保持只读/)
})
