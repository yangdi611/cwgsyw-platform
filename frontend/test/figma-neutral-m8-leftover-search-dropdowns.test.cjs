'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const instance = fs.readFileSync(
  path.resolve(__dirname, '../src/components/cmdb/CiInstanceSelect.tsx'),
  'utf8',
)
const link = fs.readFileSync(
  path.resolve(__dirname, '../src/components/cmdb/CiLinkSelector.tsx'),
  'utf8',
)
const css = fs.readFileSync(
  path.resolve(__dirname, '../src/design-system/figma-neutral/components/fields.css'),
  'utf8',
)

test('CMDB search dropdowns use Neutral listbox overlay instead of handwritten menus', () => {
  assert.match(instance, /cwgsyw-listbox cwgsyw-listbox--overlay/)
  assert.match(link, /cwgsyw-listbox cwgsyw-change-doc-ci-flow__list/)
  for (const [rel, source] of [['CiInstanceSelect', instance], ['CiLinkSelector', link]]) {
    assert.match(source, /role="listbox"/, rel)
    assert.doesNotMatch(source, /absolute z-50/, rel)
    assert.doesNotMatch(source, /shadow-lg/, rel)
    assert.doesNotMatch(source, /max-h-48/, rel)
    assert.doesNotMatch(source, /from '@\/design-system\/figma-neutral\/components'[\s\S]*Combobox/, rel)
  }
  assert.match(instance, /queryKey: \['cmdb-instance-select', keyword\]/)
  assert.match(link, /queryKey: \['cmdb-instance-search', debouncedKeyword\]/)
  assert.match(css, /\.cwgsyw-listbox--overlay/)
  assert.match(css, /max-height: calc\(var\(--cwgsyw-control-height-md\) \* 5\)/)
})
