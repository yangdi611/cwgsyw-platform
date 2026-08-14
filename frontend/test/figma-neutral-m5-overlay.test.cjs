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

const overlay = loadTsx('Overlay.tsx')

test('MenuItem exposes menuitem role and destructive type', () => {
  const html = renderToStaticMarkup(React.createElement(overlay.MenuItem, { label: '删除', type: 'destructive', shortcut: '⌘⌫' }))
  assert.match(html, /role="menuitem"/)
  assert.match(html, /data-type="destructive"/)
  assert.match(html, /⌘⌫/)
})

test('Calendar renders a grid and selected day', () => {
  const html = renderToStaticMarkup(React.createElement(overlay.Calendar, { selected: 14, monthLabel: '2026 年 8 月' }))
  assert.match(html, /role="grid"/)
  assert.match(html, /2026 年 8 月/)
  assert.match(html, /aria-selected="true"/)
})

test('Command palette has a dialog name and empty state', () => {
  const html = renderToStaticMarkup(React.createElement(overlay.CommandPalette, { items: [], state: 'empty' }))
  assert.match(html, /role="dialog"/)
  assert.match(html, /命令面板/)
  assert.match(html, /无结果/)
})

test('DatePicker keeps the date input', () => {
  const html = renderToStaticMarkup(React.createElement(overlay.DatePicker, { error: true }))
  assert.match(html, /cwgsyw-control--error/)
})

test('DateRangePicker exposes start and end date inputs', () => {
  const html = renderToStaticMarkup(React.createElement(overlay.DateRangePicker, { error: true, startValue: '2026-08-01', endValue: '2026-08-14' }))
  assert.match(html, /开始日期/)
  assert.match(html, /结束日期/)
  assert.match(html, /cwgsyw-control--error/)
  assert.match(html, /data-state="error"/)
})
