'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const bell = fs.readFileSync(
  path.resolve(__dirname, '../src/components/layout/NotificationBell.tsx'),
  'utf8',
)
const css = fs.readFileSync(
  path.resolve(__dirname, '../src/design-system/figma-neutral/components/patterns.css'),
  'utf8',
)

test('notification bell uses Neutral icon-btn chrome instead of ad-hoc tailwind control', () => {
  assert.doesNotMatch(bell, /<button[\s>]/)
  assert.doesNotMatch(bell, /w-8 h-8/)
  assert.doesNotMatch(bell, /text-\[10px\]/)
  assert.match(bell, /cwgsyw-icon-btn cwgsyw-icon-btn--md cwgsyw-icon-btn--ghost/)
  assert.match(bell, /cwgsyw-notification-count/)
  assert.match(css, /\.cwgsyw-notification-count/)
  assert.match(css, /var\(--cwgsyw-status-danger-bg\)/)
})
