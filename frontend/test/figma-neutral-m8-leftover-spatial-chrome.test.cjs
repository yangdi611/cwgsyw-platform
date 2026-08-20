'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const editor = fs.readFileSync(
  path.resolve(__dirname, '../src/features/cmdb-spatial/editor/SpatialEditor.tsx'),
  'utf8',
)

test('spatial editor inspector and palette use Neutral Select Checkbox IconButton and Button', () => {
  assert.doesNotMatch(editor, /<select[\s>]/)
  assert.doesNotMatch(editor, /type="checkbox"/)
  assert.doesNotMatch(editor, /<button[\s>]/)
  assert.match(editor, /from "@\/design-system\/figma-neutral\/components"/)
  assert.match(editor, /\bSelect\b/)
  assert.match(editor, /\bCheckbox\b/)
  assert.match(editor, /\bIconButton\b/)
  assert.match(editor, /\bNeutralDialog\b/)
  assert.match(editor, /NeutralAlertDialog/)
  assert.doesNotMatch(editor, /window\.(confirm|alert)/)
  assert.doesNotMatch(editor, /bg-black\//)
  assert.match(editor, /aria-label=\{label\}/)
  assert.match(editor, /icon=\{children\}/)
})
