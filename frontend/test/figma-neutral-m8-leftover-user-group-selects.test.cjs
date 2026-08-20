'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const files = [
  'src/components/user/UserAuthorizationDialog.tsx',
  'src/components/group/GroupDialog.tsx',
]

test('user and group dialogs use Neutral Select instead of native select', () => {
  for (const rel of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
    assert.doesNotMatch(source, /<select[\s>]/, rel)
    assert.doesNotMatch(source, /cwgsyw-native-select/, rel)
    assert.match(source, /\bSelect\b/, rel)
  }
})
