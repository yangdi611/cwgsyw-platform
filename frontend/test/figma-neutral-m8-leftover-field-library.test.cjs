'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const frontendRoot = path.resolve(__dirname, '..')
const library = fs.readFileSync(path.join(frontendRoot, 'src/components/task-template/FieldLibrary.tsx'), 'utf8')
const canvas = fs.readFileSync(path.join(frontendRoot, 'src/components/task-template/FormCanvas.tsx'), 'utf8')
const css = fs.readFileSync(
  path.join(frontendRoot, 'src/design-system/figma-neutral/components/patterns.css'),
  'utf8',
)

test('field library tiles use Neutral outline Button instead of native buttons', () => {
  assert.doesNotMatch(library, /<button[\s>]/)
  assert.match(library, /from '@\/design-system\/figma-neutral\/components'/)
  assert.match(library, /<Button[\s\S]*type="button"[\s\S]*variant="outline"/)
  assert.match(library, /className="cwgsyw-designer__type"/)
  assert.match(library, /trailingIcon=\{<span aria-hidden="true">\+<\/span>\}/)
})

test('form canvas field cards use Neutral ghost Button and keep field actions outside', () => {
  assert.doesNotMatch(canvas, /<button[\s>]/)
  assert.match(canvas, /<Button[\s\S]*type="button"[\s\S]*variant="ghost"/)
  assert.match(canvas, /className="cwgsyw-designer__field-select"/)
  assert.match(canvas, /data-selected=\{selectedKey === field.key\}/)
  assert.match(canvas, /<IconButton type="button" variant="ghost" size="sm" icon="chevron-up"/)
  assert.match(canvas, /<IconButton type="button" variant="destructive" size="sm" icon="trash"/)
})

test('designer Neutral Button overrides keep tile and field-select layout', () => {
  assert.match(css, /\.cwgsyw-designer__type\.cwgsyw-btn/)
  assert.match(css, /\.cwgsyw-designer__field-select\.cwgsyw-btn/)
  assert.match(css, /\.cwgsyw-picker-option\.cwgsyw-btn/)
  assert.match(css, /\.cwgsyw-stack-list__item\.cwgsyw-btn/)
})
