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
