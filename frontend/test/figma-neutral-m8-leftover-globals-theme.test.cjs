'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const globals = fs.readFileSync(path.resolve(__dirname, '../src/app/globals.css'), 'utf8')

test('globals compatibility theme aliases Neutral and drops sonner styling', () => {
  assert.doesNotMatch(globals, /oklch\(/)
  assert.match(globals, /--primary:\s*var\(--cwgsyw-action-primary\)/)
  assert.match(globals, /--sidebar-primary:\s*var\(--cwgsyw-action-primary\)/)
  assert.doesNotMatch(globals, /data-sonner/)
})
