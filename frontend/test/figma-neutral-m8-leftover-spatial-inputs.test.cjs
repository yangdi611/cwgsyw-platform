'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/features/cmdb-spatial/editor/SpatialEditor.tsx'),
  'utf8',
)

test('spatial editor inputs use Neutral size=sm instead of height overrides', () => {
  assert.match(source, /<Input\s+id="spatial-element-name"\s+size="sm"/)
  assert.match(source, /aria-label="批量机柜间距调整"[\s\S]{0,80}size="sm"/)
  assert.doesNotMatch(source, /className="h-8"/)
  assert.doesNotMatch(source, /className="mt-1 h-8"/)
  const inputs = source.split('<Input').length - 1
  const sized = source.split('size="sm"').length - 1
  assert.ok(sized >= inputs, `expected every Input to set size=sm, inputs=${inputs} sized=${sized}`)
})
