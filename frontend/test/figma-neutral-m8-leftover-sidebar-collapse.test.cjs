'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/components/layout/Sidebar.tsx'),
  'utf8',
)
const header = fs.readFileSync(
  path.resolve(__dirname, '../src/components/layout/Header.tsx'),
  'utf8',
)

test('Figma inset sidebar moves collapse control to the app header', () => {
  assert.match(header, /<IconButton[\s\S]*cwgsyw-app-header__sidebar-toggle/)
  assert.match(header, /aria-label=\{sidebarCollapsed \? '展开侧栏' : '收起侧栏'\}/)
  assert.match(source, /cwgsyw-sidebar__search/)
  assert.match(source, /cwgsyw-sidebar__user-trigger/)
})

test('collapsed sidebar flyouts use Neutral popover recipes', () => {
  const flyout = fs.readFileSync(
    path.resolve(__dirname, '../src/components/layout/sidebar/CollapsedEntry.tsx'),
    'utf8',
  )
  assert.match(flyout, /cwgsyw-popover w-56/)
  assert.match(flyout, /cwgsyw-popover cwgsyw-popover--compact/)
  assert.match(flyout, /createPortal/)
  assert.match(flyout, /document\.body/)
  assert.match(flyout, /onClick=\{open\}/)
  assert.match(flyout, /cwgsyw-sidebar__collapsed-group-trigger/)
  assert.doesNotMatch(flyout, /shadow-\[var\(--cwgsyw-elevation-lg\)\]/)
  assert.doesNotMatch(flyout, /cwgsyw-popover--hover/)
})
