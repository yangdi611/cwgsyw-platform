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
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  }).outputText
  const originalLoad = Module._load
  Module._load = function load(request, parent, isMain) {
    if (request.startsWith('./') && parent && parent.filename && String(parent.filename).startsWith(root)) {
      const resolved = path.join(path.dirname(parent.filename), request)
      const hit = [`${resolved}.tsx`, `${resolved}.ts`].find((candidate) => fs.existsSync(candidate))
      if (hit) return loadTsx(path.relative(root, hit))
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

const { Tabs } = loadTsx('Tabs.tsx')
const { Badge, StatusBadge, Chip } = loadTsx('Badge.tsx')
const { Avatar } = loadTsx('Avatar.tsx')
const { Card, MetricCard } = loadTsx('Card.tsx')
const { Table } = loadTsx('Table.tsx')
const { Pagination } = loadTsx('Pagination.tsx')

test('Tabs expose tab and tabpanel relations', () => {
  const html = renderToStaticMarkup(
    React.createElement(Tabs, {
      defaultValue: 'a',
      items: [
        { id: 'a', label: '概览', panel: 'A' },
        { id: 'b', label: '详情', panel: 'B' },
      ],
    }),
  )
  assert.match(html, /role="tablist"/)
  assert.match(html, /role="tab"/)
  assert.match(html, /role="tabpanel"/)
  assert.match(html, /aria-selected="true"/)
})

test('Badge status tones and Chip remove stay accessible', () => {
  const badge = renderToStaticMarkup(React.createElement(StatusBadge, { label: '告警', status: 'danger' }))
  const chip = renderToStaticMarkup(React.createElement(Chip, { label: '核心', showRemove: true }))
  assert.match(badge, /cwgsyw-badge--danger/)
  assert.match(chip, /aria-label="移除 核心"/)
})

test('Avatar and Card keep structure roles', () => {
  const avatar = renderToStaticMarkup(React.createElement(Avatar, { initials: 'YD' }))
  const card = renderToStaticMarkup(React.createElement(Card, { title: '卡片标题', description: '说明' }))
  const metric = renderToStaticMarkup(React.createElement(MetricCard, { label: '在线', value: '128', tone: 'neutral' }))
  assert.match(avatar, /YD/)
  assert.match(card, /卡片标题/)
  assert.match(metric, /data-cwgsyw-metric="neutral"/)
})

test('Table header uses the Neutral low-emphasis recipe and mobile alternative exists', () => {
  const html = renderToStaticMarkup(
    React.createElement(Table, {
      columns: [{ key: 'name', label: '名称' }],
      rows: [{ id: '1', cells: { name: '核心交换机' } }],
    }),
  )
  assert.match(html, /cwgsyw-th/)
  assert.match(html, /名称/)
  assert.match(html, /cwgsyw-table-mobile/)
  assert.match(html, /核心交换机/)
})

test('Table header recipe matches the Figma Neutral density', () => {
  const css = fs.readFileSync(path.join(root, 'display.css'), 'utf8')
  const headerRule = css.slice(css.indexOf('.cwgsyw-th {'), css.indexOf('.cwgsyw-td {'))
  const cellRule = css.slice(css.indexOf('.cwgsyw-td {'), css.indexOf('.cwgsyw-table--compact'))
  const tableRule = css.slice(css.indexOf('.cwgsyw-table {'), css.indexOf('.cwgsyw-th {'))
  assert.match(tableRule, /min-width: max-content/)
  assert.match(headerRule, /height: 34px/)
  assert.match(headerRule, /background: var\(--cwgsyw-border-subtle\)/)
  assert.match(headerRule, /color: var\(--cwgsyw-text-tertiary\)/)
  assert.match(headerRule, /white-space: nowrap/)
  assert.match(cellRule, /white-space: nowrap/)
  assert.doesNotMatch(headerRule, /action-primary/)
})

test('Pagination disables edges and marks current page', () => {
  const html = renderToStaticMarkup(React.createElement(Pagination, { page: 1, pageCount: 3, totalCount: 30 }))
  const css = fs.readFileSync(path.join(root, 'display.css'), 'utf8')
  const paginationRule = css.slice(css.indexOf('.cwgsyw-pagination {'), css.indexOf('.cwgsyw-pagination .cwgsyw-type-label-sm'))
  const pageItemRule = css.slice(css.indexOf('.cwgsyw-page-item {'), css.indexOf('.cwgsyw-page-item[aria-current="page"]'))
  assert.match(html, /aria-label="上一页"/)
  assert.match(html, /disabled=""/)
  assert.match(html, /aria-current="page"/)
  assert.doesNotMatch(html, /共 30 条/)
  assert.match(paginationRule, /width: 100%/)
  assert.match(paginationRule, /justify-content: flex-end/)
  assert.match(paginationRule, /padding-top: var\(--cwgsyw-space-6\)/)
  assert.match(paginationRule, /gap: var\(--cwgsyw-space-1\)/)
  assert.match(pageItemRule, /display: inline-flex/)
  assert.match(pageItemRule, /align-items: center/)
  assert.match(pageItemRule, /justify-content: center/)
  assert.match(pageItemRule, /padding: 0/)
  assert.match(pageItemRule, /width: 22px/)
  assert.match(pageItemRule, /height: 22px/)
  assert.match(pageItemRule, /\.cwgsyw-page-item \.cwgsyw-icon \{ width: 12px; height: 12px; \}/)
})
