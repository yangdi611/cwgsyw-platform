'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const files = [
  'src/app/(dashboard)/groups/page.tsx',
  'src/app/(dashboard)/change-docs/new/components/TemplateSelector.tsx',
  'src/app/(dashboard)/devices/[id]/page.tsx',
  'src/app/(auth)/login/page.tsx',
  'src/components/cmdb/ChangeRecordItem.tsx',
  'src/components/cmdb/RackAssignmentCard.tsx',
  'src/components/task-analytics/TaskAutomationsManager.tsx',
  'src/components/task-analytics/TaskAnalyticsWorkbench.tsx',
  'src/components/task-analytics/TaskMetricsManager.tsx',
  'src/components/task-analytics/TaskAnalyticsDashboard.tsx',
]

test('remaining chrome lists use Neutral Button or Card instead of native buttons', () => {
  for (const rel of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
    assert.doesNotMatch(source, /<button[\s>]/, rel)
  }
})

test('login password toggle uses Neutral IconButton', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/app/(auth)/login/page.tsx'), 'utf8')
  assert.match(source, /<IconButton/)
  assert.match(source, /aria-label=\{showPassword \? '隐藏密码' : '显示密码'\}/)
})
