'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const source = fs.readFileSync(
  path.resolve(__dirname, '../src/components/wiki/WikiTreeSidebar.tsx'),
  'utf8',
)

test('wiki tree status dots use Neutral status tokens', () => {
  assert.doesNotMatch(source, /bg-v2-muted|bg-v2-subtle|bg-amber-500|bg-emerald-500/)
  assert.match(source, /draft: 'bg-\[var\(--cwgsyw-text-tertiary\)\]'/)
  assert.match(source, /review: 'bg-\[var\(--cwgsyw-status-warning-fg\)\]'/)
  assert.match(source, /published: 'bg-\[var\(--cwgsyw-status-success-fg\)\]'/)
  assert.match(source, /archived: 'bg-\[var\(--cwgsyw-text-secondary\)\]'/)
})
