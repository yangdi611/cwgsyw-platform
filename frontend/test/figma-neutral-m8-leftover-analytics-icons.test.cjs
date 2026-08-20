'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const files = [
  'src/components/task-analytics/TaskAnalyticsDashboard.tsx',
  'src/components/task-analytics/TaskMetricsManager.tsx',
]

test('analytics chrome uses Neutral trash close eye and chevron icons', () => {
  for (const rel of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
    assert.doesNotMatch(source, /Trash2/, rel)
    assert.doesNotMatch(source, /ChevronRight/, rel)
    assert.doesNotMatch(source, /\bEye\b/, rel)
    assert.doesNotMatch(source, /lucide-react/, rel)
    assert.match(source, /from '@\/design-system\/figma-neutral\/components'/, rel)
  }
  const dashboard = fs.readFileSync(path.resolve(__dirname, '../src/components/task-analytics/TaskAnalyticsDashboard.tsx'), 'utf8')
  const metrics = fs.readFileSync(path.resolve(__dirname, '../src/components/task-analytics/TaskMetricsManager.tsx'), 'utf8')
  assert.match(dashboard, /FigmaTrashIcon/)
  assert.match(dashboard, /icon="close"/)
  assert.match(dashboard, /name="eye"/)
  assert.match(dashboard, /leadingIcon="chevron-right"/)
  assert.match(dashboard, /aria-label="导出 CSV"/)
  assert.match(dashboard, /aria-label="下载附件"/)
  assert.match(dashboard, /cwgsyw-btn cwgsyw-btn--sm cwgsyw-btn--outline/)
  assert.match(metrics, /aria-label=\{label\}/)
  assert.match(metrics, /label="编辑目标"/)
  assert.match(metrics, /label="删除目标"/)
})
