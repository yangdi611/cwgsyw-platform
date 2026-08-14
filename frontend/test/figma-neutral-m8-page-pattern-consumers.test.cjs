'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const consumers = [
  ['FormSettingsPage', 'src/app/(auth)/login/page.tsx'],
  ['DataManagementPage', 'src/app/(dashboard)/users/page.tsx'],
  ['DetailDrawerPage', 'src/app/(dashboard)/devices/[id]/page.tsx'],
  ['DashboardFeedbackPage', 'src/app/(dashboard)/page.tsx'],
  ['OverlayDestructivePage', 'src/app/(dashboard)/admin/backup/page.tsx'],
]

test('each of the five page patterns has a real route consumer', () => {
  for (const [name, rel] of consumers) {
    const source = fs.readFileSync(path.join(frontendRoot, rel), 'utf8')
    assert.match(source, new RegExp(`\\b${name}\\b`), rel)
  }
})
