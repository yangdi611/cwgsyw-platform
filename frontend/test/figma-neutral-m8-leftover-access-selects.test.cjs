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
