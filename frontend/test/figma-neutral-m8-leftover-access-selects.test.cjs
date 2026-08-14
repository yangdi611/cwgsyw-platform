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
  assert.match(source, /icon="trash"/)
  assert.match(source, /aria-label="删除授权"/)
  assert.match(source, /IconButton, Input, NeutralDialog, Select/)
  assert.doesNotMatch(source, /h-9 w-9/)
  assert.match(source, /queryKey = \['resource-access', resourceType, resourceId\]/)
})

