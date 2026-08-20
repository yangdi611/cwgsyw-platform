'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const files = [
  'src/components/ops-calendar/CalendarMonthView.tsx',
  'src/components/ops-calendar/CalendarWeekView.tsx',
  'src/components/ops-calendar/DayWorkItemsDialog.tsx',
  'src/app/(dashboard)/ops-calendar/page.tsx',
]

test('ops calendar views use Neutral Button and MenuItem instead of native buttons', () => {
  for (const rel of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
    assert.doesNotMatch(source, /<button[\s>]/, rel)
  }
  const overlay = fs.readFileSync(
    path.resolve(__dirname, '../src/design-system/figma-neutral/components/Overlay.tsx'),
    'utf8',
  )
  assert.match(overlay, /onClick\?: \(\) => void/)
})
