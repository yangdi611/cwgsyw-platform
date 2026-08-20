'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/components/authorization/ResourceAccessDialog.tsx'),
  'utf8',
)

test('resource access dialog uses Neutral Select instead of native select', () => {
  assert.doesNotMatch(source, /<select[\s>]/)
  assert.match(source, /\bSelect\b/)
  assert.match(source, /from '@\/design-system\/figma-neutral\/components'/)
})

test('resource access delete control uses Neutral IconButton and imports Select', () => {
  assert.match(source, /<IconButton/)
  assert.match(source, /figma-action-icon--trash/)
  assert.match(source, /aria-label="删除授权"/)
  assert.match(source, /NeutralTooltip/)
  assert.match(source, /overlay/)
  assert.doesNotMatch(source, /icon="trash"/)
  assert.doesNotMatch(source, /h-9 w-9/)
  assert.doesNotMatch(source, /text-sm font-medium/)
  assert.match(source, /queryKey = \['resource-access', resourceType, resourceId\]/)
})

test('resource access checkboxes use the compact 16px Neutral recipe', () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, '../src/design-system/figma-neutral/components/patterns.css'),
    'utf8',
  )
  assert.match(css, /\.cwgsyw-resource-access \.cwgsyw-choice input \{[\s\S]{0,80}width: 16px/)
  assert.match(css, /\.cwgsyw-resource-access \.cwgsyw-choice \{[\s\S]{0,80}min-height: 16px/)
})

test('resource access dialog uses the Neutral white-content recipe', () => {
  const css = fs.readFileSync(
    path.resolve(__dirname, '../src/design-system/figma-neutral/components/patterns.css'),
    'utf8',
  )
  assert.match(source, /className="cwgsyw-resource-access-dialog"/)
  assert.match(source, /cwgsyw-resource-access__advanced-toggle/)
  assert.match(css, /\.cwgsyw-dialog\.cwgsyw-resource-access-dialog \.cwgsyw-dialog__body \{[\s\S]{0,80}background: var\(--cwgsyw-bg-surface\)/)
  assert.match(css, /\.cwgsyw-dialog\.cwgsyw-resource-access-dialog \.cwgsyw-dialog__title-group \.cwgsyw-type-title-sm \{[\s\S]{0,80}font-size: 16px/)
  assert.doesNotMatch(css, /\.cwgsyw-resource-access__empty \{[\s\S]{0,80}border: 1px dashed/)
})
