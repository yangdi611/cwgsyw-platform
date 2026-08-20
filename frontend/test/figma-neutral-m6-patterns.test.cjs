'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const Module = require('node:module')
const path = require('node:path')
const test = require('node:test')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const root = path.resolve(__dirname, '../src/design-system/figma-neutral/components')

function loadTsx(rel) {
  const filePath = path.join(root, rel)
  const source = fs.readFileSync(filePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filePath,
  }).outputText
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.startsWith('./') && parent && parent.filename && String(parent.filename).startsWith(root)) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`].find((c) => fs.existsSync(c))
      if (hit) return loadTsx(path.relative(root, hit))
    }
    return originalLoad.call(this, request, parent, isMain)
  }
  const mod = new Module(filePath, module)
  mod.filename = filePath
  mod.paths = Module._nodeModulePaths(path.dirname(filePath))
  try { mod._compile(compiled, filePath) } finally { Module._load = originalLoad }
  return mod.exports
}

const P = loadTsx('Patterns.tsx')

test('Breadcrumb marks the current page', () => {
  const html = renderToStaticMarkup(
    React.createElement(P.Breadcrumb, { items: [{ href: '/', label: '首页' }, { label: '实例管理' }] }),
  )
  assert.match(html, /aria-label="面包屑"/)
  assert.match(html, /aria-current="page"/)
})

test('Page header exposes a heading and compact layout attribute', () => {
  const html = renderToStaticMarkup(React.createElement(P.PageHeader, { title: '实例管理', layout: 'compact' }))
  assert.match(html, /<h1/)
  assert.match(html, /实例管理/)
  assert.match(html, /data-layout="compact"/)
})

test('Five page patterns render their composition slots', () => {
  const form = renderToStaticMarkup(React.createElement(P.FormSettingsPage, { header: 'H', form: 'F', supporting: 'S', layout: 'default' }))
  const singleForm = renderToStaticMarkup(React.createElement(P.FormSettingsPage, { header: 'H', form: 'F', layout: 'default' }))
  const data = renderToStaticMarkup(React.createElement(P.DataManagementPage, { header: 'H', toolbar: 'T', filter: 'F', content: 'C' }))
  const detail = renderToStaticMarkup(React.createElement(P.DetailDrawerPage, { header: 'H', content: 'C', drawer: 'D' }))
  const singleDetail = renderToStaticMarkup(React.createElement(P.DetailDrawerPage, { header: 'H', content: 'C' }))
  const dash = renderToStaticMarkup(React.createElement(P.DashboardFeedbackPage, { header: 'H', metrics: 'M', feedback: 'Fb', className: 'cwgsyw-cmdb-page' }))
  const overlay = renderToStaticMarkup(React.createElement(P.OverlayDestructivePage, { header: 'H', confirmation: 'Confirm' }))
  assert.match(form, /cwgsyw-page__grid/)
  assert.doesNotMatch(form, /cwgsyw-page__grid--single/)
  assert.match(singleForm, /cwgsyw-page__grid--single/)
  assert.match(data, /HTF/)
  assert.match(detail, /D/)
  assert.doesNotMatch(detail, /cwgsyw-page__grid--single/)
  assert.match(singleDetail, /cwgsyw-page__grid--single/)
  assert.match(dash, /cwgsyw-page__metrics/)
  assert.match(dash, /cwgsyw-cmdb-page/)
  assert.match(overlay, /Confirm/)
})

test('Page patterns allow content regions to shrink inside the app shell', () => {
  const css = fs.readFileSync(path.join(root, 'patterns.css'), 'utf8')
  const pageRule = css.slice(css.indexOf('.cwgsyw-page {'), css.indexOf('.cwgsyw-page--compact'))
  assert.match(pageRule, /min-width: 0/)
  assert.match(pageRule, /background: var\(--cwgsyw-bg-surface\)/)
  assert.doesNotMatch(pageRule, /background: var\(--cwgsyw-bg-canvas\)/)
  assert.match(css, /\.cwgsyw-page > section,[\s\S]*\.cwgsyw-page__grid > aside \{ min-width: 0; \}/)
})

test('Tree rows retain action access on narrow screens', () => {
  const css = fs.readFileSync(path.join(root, 'patterns.css'), 'utf8')
  const mobileRule = css.slice(css.indexOf('.cwgsyw-tree-item { min-width: 0; flex-wrap: wrap; }'), css.indexOf('.cwgsyw-split__pane {'))
  assert.match(mobileRule, /\.cwgsyw-tree-item__actions \{ width: 100%; justify-content: flex-end; margin-left: 0; \}/)
  assert.match(mobileRule, /text-overflow: ellipsis/)
})
