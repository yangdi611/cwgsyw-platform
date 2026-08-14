'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const files = [
  'src/components/task-analytics/TaskAnalyticsDashboard.tsx',
  'src/components/task-analytics/TaskMetricsManager.tsx',
]

test('analytics dashboard and metrics use Neutral Select instead of native select', () => {
  for (const rel of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
    assert.doesNotMatch(source, /<select[\s>]/, rel)
    assert.match(source, /\bSelect\b/, rel)
  }
})
