'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const files = [
  'src/components/task-template/TaskTemplateDetail.tsx',
  'src/components/task-plan/CiScopeSelector.tsx',
  'src/components/task-plan/TaskPlanEditor.tsx',
  'src/components/cmdb/CiInstanceSelect.tsx',
  'src/components/cmdb/CiLinkSelector.tsx',
]

test('designer and picker leftovers use Neutral Button instead of native buttons', () => {
  for (const rel of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8')
    assert.doesNotMatch(source, /<button[\s>]/, rel)
    assert.match(source, /\bButton\b/, rel)
  }
})

test('CMDB pickers keep Neutral option rows and existing remove actions', () => {
  const instance = fs.readFileSync(path.resolve(__dirname, '../src/components/cmdb/CiInstanceSelect.tsx'), 'utf8')
  const link = fs.readFileSync(path.resolve(__dirname, '../src/components/cmdb/CiLinkSelector.tsx'), 'utf8')
  assert.match(instance, /className="cwgsyw-picker-option"/)
  assert.match(instance, />\s*清除\s*</)
  assert.match(instance, /cwgsyw-listbox cwgsyw-listbox--overlay/)
  assert.doesNotMatch(instance, /absolute z-50/)
  assert.match(link, /className="cwgsyw-picker-option"/)
  assert.match(link, /handleRemove/)
  assert.match(link, /cwgsyw-listbox cwgsyw-listbox--overlay/)
  assert.doesNotMatch(link, /absolute z-50/)
})
