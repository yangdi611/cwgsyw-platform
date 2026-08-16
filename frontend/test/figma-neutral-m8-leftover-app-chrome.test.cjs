'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const files = [
  'src/components/layout/Header.tsx',
  'src/components/layout/sidebar/NavGroupItem.tsx',
  'src/components/layout/sidebar/CollapsedEntry.tsx',
]

test('app header and sidebar chrome use Neutral controls without redundant header actions', () => {
  for (const rel of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
    assert.doesNotMatch(source, /<button[\s>]/, rel)
  }
  const header = fs.readFileSync(path.resolve(__dirname, '../src/components/layout/Header.tsx'), 'utf8')
  const sidebar = fs.readFileSync(path.resolve(__dirname, '../src/components/layout/Sidebar.tsx'), 'utf8')
  assert.match(sidebar, /MenuItem/)
  assert.match(sidebar, /aria-label="打开用户菜单"/)
  assert.doesNotMatch(header, /NotificationBell/)
  assert.doesNotMatch(header, /搜索/)
  assert.doesNotMatch(header, /新建变更/)
  const patterns = fs.readFileSync(path.resolve(__dirname, '../src/design-system/figma-neutral/components/patterns.css'), 'utf8')
  const appHeaderRules = patterns.slice(patterns.indexOf('.cwgsyw-app-header {'), patterns.indexOf('.cwgsyw-app-header__context'))
  assert.doesNotMatch(appHeaderRules, /border-bottom/)
  assert.match(patterns, /backdrop-filter: blur\(18px\)/)
})
