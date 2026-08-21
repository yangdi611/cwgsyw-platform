'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

test('wiki tree move actions use Neutral overflow menu items', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/wiki/WikiTreeSidebar.tsx'), 'utf8')
  assert.doesNotMatch(source, /ArrowUp|ArrowDown|Trash2/)
  assert.doesNotMatch(source, /icon="chevron-up"|icon="chevron-down"|icon="trash"/)
  assert.match(source, /label="上移"/)
  assert.match(source, /label="下移"/)
  assert.match(source, /label="删除"/)
  assert.match(source, /cwgsyw-wiki-tree__more-icon/)
})

test('spatial editor chrome uses verified Figma icon assets', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/features/cmdb-spatial/editor/SpatialEditor.tsx'), 'utf8')
  assert.doesNotMatch(source, /lucide-react|Trash2|ChevronRight|ArrowLeft/)
  assert.match(source, /SpatialFigmaIcon name="trash"/)
  assert.match(source, /SpatialFigmaIcon name="chevron-previous"/)
  assert.match(source, /SpatialFigmaIcon name="lock"/)
  assert.match(source, /SpatialFigmaIcon name="unlock"/)
})

test('wiki mermaid copied state uses Neutral check icon', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/wiki/WikiMermaid.tsx'), 'utf8')
  assert.doesNotMatch(source, /\bCheck,|Check }/)
  assert.match(source, /name="check"/)
})
