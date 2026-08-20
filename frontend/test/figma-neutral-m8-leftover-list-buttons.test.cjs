'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const files = [
  'src/components/task-runtime/TaskList.tsx',
  'src/components/work/WorkItemList.tsx',
  'src/components/cmdb/BatchEditDialog.tsx',
]

test('task work and batch-edit lists use Neutral Button instead of raw cwgsyw-btn', () => {
  for (const rel of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
    assert.doesNotMatch(source, /<button[\s>]/, rel)
    assert.match(source, /\bButton\b/, rel)
  }
})
