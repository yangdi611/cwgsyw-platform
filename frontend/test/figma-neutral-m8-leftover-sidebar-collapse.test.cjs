'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/components/layout/Sidebar.tsx'),
  'utf8',
)

test('sidebar collapse controls use Neutral IconButton', () => {
  assert.match(source, /from '@\/design-system\/figma-neutral\/components'/)
  assert.match(source, /<IconButton[\s\S]*aria-label="收起侧栏"/)
  assert.match(source, /<IconButton[\s\S]*aria-label="展开侧栏"/)
  assert.doesNotMatch(source, /<button[\s\S]*aria-label="收起侧栏"/)
  assert.doesNotMatch(source, /<button[\s\S]*aria-label="展开侧栏"/)
})

test('collapsed sidebar flyouts use Neutral popover recipes', () => {
  const flyout = fs.readFileSync(
    path.resolve(__dirname, '../src/components/layout/sidebar/CollapsedEntry.tsx'),
    'utf8',
  )
  assert.match(flyout, /cwgsyw-popover w-56/)
  assert.match(flyout, /cwgsyw-popover cwgsyw-popover--compact/)
  assert.doesNotMatch(flyout, /shadow-\[var\(--cwgsyw-elevation-lg\)\]/)
  assert.doesNotMatch(flyout, /cwgsyw-popover--hover/)
})
