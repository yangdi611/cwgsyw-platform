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

test('app header and sidebar chrome use Neutral Button and MenuItem', () => {
  for (const rel of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
    assert.doesNotMatch(source, /<button[\s>]/, rel)
  }
  const header = fs.readFileSync(path.resolve(__dirname, '../src/components/layout/Header.tsx'), 'utf8')
  assert.match(header, /MenuItem/)
  assert.match(header, /aria-label="打开用户菜单"/)
  assert.match(header, /leadingIcon="search"/)
})
