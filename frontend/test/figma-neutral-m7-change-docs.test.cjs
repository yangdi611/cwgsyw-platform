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
const pagePath = path.join(frontendRoot, 'src/app/(dashboard)/change-docs/page.tsx')
const createPagePath = path.join(frontendRoot, 'src/app/(dashboard)/change-docs/new/page.tsx')
const templateSelectorPath = path.join(frontendRoot, 'src/app/(dashboard)/change-docs/new/components/TemplateSelector.tsx')
const detailPagePath = path.join(frontendRoot, 'src/app/(dashboard)/change-docs/[id]/page.tsx')
const actionBarPath = path.join(frontendRoot, 'src/app/(dashboard)/change-docs/[id]/components/DocActionBar.tsx')

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
    if (request === 'next/navigation') return { useRouter: () => ({ replace() {}, push() {} }) }
    if (request === '@/hooks/usePermission') return { usePermission: () => ({ hasPermission: () => true, isHydrated: true }) }
    if (request === '@/lib/api') return { get: async () => ({ data: { data: { records: [], total: 0 } } }) }
    if (request === '@tanstack/react-query') {
      return {
        useQuery: () => ({
          data: {
            records: [{
              id: 7,
              changeNo: 'CHG-2026-0007',
              title: '核心交换机变更',
              status: 'pending',
              applicationTemplateId: 1,
              applicationTemplateName: '网络变更申请单',
              planTemplateId: 2,
              planTemplateName: '网络变更方案',
              applicantName: 'admin',
              createdAt: '2026-08-14T10:00:00Z',
            }],
            total: 1,
            page: 1,
            size: 20,
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

test('change-docs leaves old visual entries and keeps APIs', () => {
  const page = fs.readFileSync(pagePath, 'utf8')
  assert.match(page, /figma-neutral\/index\.css/)
  assert.match(page, /queryKey: \['change-docs', statusFilter, keyword, page\]/)
  assert.match(page, /\/change-docs/)
  assert.match(page, /hasPermission\('change_doc', 'read'\)/)
  assert.match(page, /hasPermission\('change_doc', 'create'\)/)
  assert.match(page, /className="cwgsyw-change-docs-list"/)
  assert.match(page, /density="compact"/)
  assert.match(page, /className="cwgsyw-change-docs-preview-drawer"/)
  assert.match(page, /showClose/)
  assert.doesNotMatch(page, /breadcrumb=\{<Breadcrumb/)
  assert.doesNotMatch(page, /@\/components\/design-system/)
  assert.doesNotMatch(page, /@\/components\/shared/)
  assert.doesNotMatch(page, /text-v2-/)
  assert.doesNotMatch(page, /border-v2-/)
})

test('change-docs renders Neutral management table', () => {
  const page = loadCompiled(pagePath)
  const html = renderToStaticMarkup(React.createElement(page.default))
  assert.match(html, /变更文档/)
  assert.match(html, /新建变更/)
  assert.match(html, /核心交换机变更/)
  assert.match(html, /CHG-2026-0007/)
  assert.match(html, /待审批/)
  assert.match(html, /cwgsyw-change-docs-list/)
  assert.match(html, /cwgsyw-change-docs-list__table/)
})

test('new change document uses the compact two-step Neutral composition', () => {
  const page = fs.readFileSync(createPagePath, 'utf8')
  const selector = fs.readFileSync(templateSelectorPath, 'utf8')

  assert.match(page, /className="cwgsyw-change-doc-create"/)
  assert.match(page, /cwgsyw-change-doc-create__steps/)
  assert.match(page, /aria-label="新建变更文档进度"/)
  assert.doesNotMatch(page, /\bBreadcrumb\b/)
  assert.match(selector, /cwgsyw-change-doc-template-selector__grid/)
  assert.match(selector, /padding="sm"/)
  assert.doesNotMatch(selector, /<strong>/)
})

test('change document detail uses the compact Neutral detail composition', () => {
  const page = fs.readFileSync(detailPagePath, 'utf8')
  const actionBar = fs.readFileSync(actionBarPath, 'utf8')

  assert.match(page, /className="cwgsyw-change-doc-detail"/)
  assert.match(page, /cwgsyw-change-doc-detail__metadata/)
  assert.match(page, /cwgsyw-change-doc-detail__templates/)
  assert.match(page, /返回列表/)
  assert.doesNotMatch(page, /\bBreadcrumb\b/)
  assert.match(actionBar, /cwgsyw-change-doc-detail__action-bar/)
})
